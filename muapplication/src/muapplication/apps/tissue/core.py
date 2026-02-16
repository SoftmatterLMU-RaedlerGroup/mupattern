"""mutissue core – segment crops with Cellpose v4, measure per-cell fluorescence. Used by CLI and API."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import zarr

from ...common.progress import ProgressCallback


def run_segment(
    zarr_path: Path,
    pos: int,
    channel_phase: int,
    channel_fluorescence: int,
    output_masks: Path,
    *,
    on_progress: ProgressCallback | None = None,
) -> None:
    """Segment each crop per frame with Cellpose v4 (phase + fluorescence), save masks to masks.zarr (same layout as crops)."""
    from cellpose.models import CellposeModel

    store = zarr.DirectoryStore(str(zarr_path))
    root = zarr.open_group(store, mode="r")
    crop_grp = root[f"pos/{pos:03d}/crop"]
    crop_ids = sorted(crop_grp.keys())

    try:
        model = CellposeModel(pretrained_model="cpsam", gpu=True)
    except Exception:
        model = CellposeModel(pretrained_model="cpsam", gpu=False)

    out_store = zarr.DirectoryStore(str(output_masks))
    out_root = zarr.open_group(out_store, mode="a")
    pos_grp = out_root.require_group(f"pos/{pos:03d}")
    mask_crop_grp = pos_grp.require_group("crop")

    n_crops = len(crop_ids)
    total_work = sum(int(crop_grp[cid].shape[0]) for cid in crop_ids)
    done = 0

    for crop_idx, crop_id in enumerate(crop_ids):
        arr = crop_grp[crop_id]
        n_times, _, _, h, w = arr.shape
        mask_arr = mask_crop_grp.zeros(
            crop_id,
            shape=(n_times, h, w),
            chunks=(1, h, w),
            dtype=np.uint32,
            overwrite=True,
        )
        mask_arr.attrs["axis_names"] = ["t", "y", "x"]

        for t in range(n_times):
            phase = np.array(arr[t, channel_phase, 0], dtype=np.float32)
            fluo = np.array(arr[t, channel_fluorescence, 0], dtype=np.float32)
            image = np.stack([phase, fluo, phase], axis=-1)

            masks_list, *_ = model.eval(
                [image],
                channel_axis=-1,
                batch_size=1,
                normalize=True,
            )
            masks = masks_list[0] if isinstance(masks_list, list) else masks_list
            mask_arr[t] = np.asarray(masks, dtype=np.uint32)

            done += 1
            if on_progress and total_work > 0:
                on_progress(done / total_work, f"Crop {crop_idx + 1}/{n_crops}, frame {t + 1}/{n_times}")

    if on_progress:
        on_progress(1.0, f"Wrote masks to {output_masks}")


def run_analyze(
    zarr_path: Path,
    masks_path: Path,
    pos: int,
    channel_fluorescence: int,
    output: Path,
    *,
    on_progress: ProgressCallback | None = None,
) -> None:
    """Load crops.zarr and masks.zarr; compute per-cell total fluorescence, cell area, background; write CSV."""
    crop_store = zarr.DirectoryStore(str(zarr_path))
    crop_root = zarr.open_group(crop_store, mode="r")
    pos_grp = crop_root[f"pos/{pos:03d}"]
    crop_grp = pos_grp["crop"]
    crop_ids = sorted(crop_grp.keys())
    try:
        bg_arr = pos_grp["background"]
    except KeyError:
        bg_arr = None  # missing → background 0

    mask_store = zarr.DirectoryStore(str(masks_path))
    mask_root = zarr.open_group(mask_store, mode="r")
    mask_crop_grp = mask_root[f"pos/{pos:03d}/crop"]

    rows: list[tuple[int, str, int, float, int, float]] = []
    n_crops = len(crop_ids)
    total_work = sum(int(crop_grp[cid].shape[0]) for cid in crop_ids)
    done = 0

    for crop_idx, crop_id in enumerate(crop_ids):
        crop_arr = crop_grp[crop_id]
        mask_arr = mask_crop_grp[crop_id]
        n_times = crop_arr.shape[0]
        for t in range(n_times):
            fluo = np.array(crop_arr[t, channel_fluorescence, 0], dtype=np.float64)
            masks = np.array(mask_arr[t])
            background = float(bg_arr[t, channel_fluorescence, 0]) if bg_arr is not None else 0.0  # per-pixel
            for cell_id in np.unique(masks):
                if cell_id == 0:
                    continue
                cell_mask = masks == cell_id
                total_fluorescence = float(np.sum(fluo[cell_mask]))
                cell_area = int(np.sum(cell_mask))
                rows.append((t, crop_id, int(cell_id), total_fluorescence, cell_area, background))
            done += 1
            if on_progress and total_work > 0:
                on_progress(done / total_work, f"Crop {crop_idx + 1}/{n_crops}, frame {t + 1}/{n_times}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", newline="") as fh:
        fh.write("t,crop,cell,total_fluorescence,cell_area,background\n")
        for t, crop, cell, total_fluorescence, cell_area, background in rows:
            fh.write(f"{t},{crop},{cell},{total_fluorescence},{cell_area},{background}\n")

    if on_progress:
        on_progress(1.0, f"Wrote {len(rows)} rows to {output}")


def run_plot(input_csv: Path, output: Path, gfp_threshold: float) -> None:
    """Plot GFP+ count and mean/median (total_fluorescence/cell_area - background) over time. GFP+ = mean intensity above background > threshold."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    import pandas as pd

    df = pd.read_csv(input_csv, dtype={"crop": str})
    df["mean_above_bg"] = (df["total_fluorescence"] / df["cell_area"]) - df["background"]
    gfp = df[df["mean_above_bg"] > gfp_threshold]
    per_t = (
        gfp.groupby("t")
        .agg(
            n_gfp=("cell", "count"),
            mean_above_bg=("mean_above_bg", "mean"),
            median_above_bg=("mean_above_bg", "median"),
        )
        .reset_index()
    )

    fig, (ax_count, ax_fluo) = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
    ax_count.plot(per_t["t"], per_t["n_gfp"], label="GFP+ cells")
    ax_count.set_ylabel("Number of GFP+ cells")
    ax_count.set_title("GFP-expressing cells per frame")
    ax_count.legend()

    ax_fluo.plot(per_t["t"], per_t["mean_above_bg"], label="Mean")
    ax_fluo.plot(per_t["t"], per_t["median_above_bg"], label="Median")
    ax_fluo.set_xlabel("t")
    ax_fluo.set_ylabel("Mean intensity − background")
    ax_fluo.set_title(f"Per-cell mean intensity above background (GFP+, threshold={gfp_threshold})")
    ax_fluo.legend()

    output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(output, dpi=150, bbox_inches="tight")
    plt.close()
