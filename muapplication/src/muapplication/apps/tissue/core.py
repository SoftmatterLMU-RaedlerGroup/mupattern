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


def run_plot(input_csv: Path, output_dir: Path, gfp_threshold: float) -> None:
    """Plot GFP+ count and median (total − area×background) per crop over time, one color per crop. Writes two square plots into output_dir: gfp_count.png and median_fluorescence.png. For accurate total fluorescence use the expression module."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    import pandas as pd

    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    count_path = output_dir / "gfp_count.png"
    fluo_path = output_dir / "median_fluorescence.png"

    df = pd.read_csv(input_csv, dtype={"crop": str})
    df["mean_above_bg"] = (df["total_fluorescence"] / df["cell_area"]) - df["background"]
    df["fluo_above_bg"] = df["total_fluorescence"] - df["cell_area"] * df["background"]
    gfp = df[df["mean_above_bg"] > gfp_threshold]
    crops = sorted(gfp["crop"].unique())
    size = 6  # squareish

    if not crops:
        fig, ax = plt.subplots(figsize=(size, size))
        ax.set_ylabel("Number of GFP+ cells")
        ax.set_title(f"GFP+ cells per crop (threshold={gfp_threshold})")
        ax.set_xlabel("t")
        plt.tight_layout()
        plt.savefig(count_path, dpi=150, bbox_inches="tight")
        plt.close()
        fig, ax = plt.subplots(figsize=(size, size))
        ax.set_ylabel("Median (total − area×background)")
        ax.set_title(f"Median fluorescence per crop, GFP+ (threshold={gfp_threshold})")
        ax.set_xlabel("t")
        plt.tight_layout()
        plt.savefig(fluo_path, dpi=150, bbox_inches="tight")
        plt.close()
        return

    cmap = plt.get_cmap("tab10" if len(crops) <= 10 else "tab20")
    colors = [cmap(i % cmap.N) for i in range(len(crops))]
    median_per_t = gfp.groupby(["crop", "t"])["fluo_above_bg"].median().reset_index()
    median_per_t.columns = ["crop", "t", "median_above_bg"]

    fig, ax = plt.subplots(figsize=(size, size))
    for i, crop in enumerate(crops):
        color = colors[i]
        crop_gfp = gfp[gfp["crop"] == crop]
        per_t_count = crop_gfp.groupby("t")["cell"].count().reset_index()
        per_t_count.columns = ["t", "n_gfp"]
        ax.plot(per_t_count["t"], per_t_count["n_gfp"], color=color, linestyle="-")
    ax.set_ylabel("Number of GFP+ cells")
    ax.set_title(f"GFP+ cells per crop (threshold={gfp_threshold})")
    ax.set_xlabel("t")
    plt.tight_layout()
    plt.savefig(count_path, dpi=150, bbox_inches="tight")
    plt.close()

    fig, ax = plt.subplots(figsize=(size, size))
    for i, crop in enumerate(crops):
        color = colors[i]
        crop_med = median_per_t[median_per_t["crop"] == crop]
        ax.plot(crop_med["t"], crop_med["median_above_bg"], color=color, linestyle="-")
    ax.set_xlabel("t")
    ax.set_ylabel("Median (total − area×background)")
    ax.set_title(f"Median fluorescence per crop, GFP+ (threshold={gfp_threshold})")
    plt.tight_layout()
    plt.savefig(fluo_path, dpi=150, bbox_inches="tight")
    plt.close()
