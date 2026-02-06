"""mutrain predict – run inference on crops.zarr and output annotations CSV."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import numpy as np
import torch
import typer
import yaml
import zarr
from PIL import Image as PILImage
from rich.progress import track
from transformers import AutoImageProcessor, AutoModelForImageClassification

predict_app = typer.Typer(help="Prediction / inference commands.")


def _predict_position(
    zarr_path: Path,
    pos: str,
    model: AutoModelForImageClassification,
    processor: AutoImageProcessor,
    device: torch.device,
    batch_size: int,
    t_range: tuple[int, int] | None,
    crop_range: tuple[int, int] | None,
) -> list[dict]:
    """Run inference on (crop, t) pairs for a position. Returns list of {t, crop, label}."""
    store = zarr.DirectoryStore(str(zarr_path))
    root = zarr.open_group(store, mode="r")

    crop_grp = root[f"pos/{pos}/crop"]
    crop_ids = sorted(crop_grp.keys())

    # Apply crop range filter
    if crop_range is not None:
        crop_ids = [c for c in crop_ids if crop_range[0] <= int(c) < crop_range[1]]

    results: list[dict] = []
    batch_imgs: list[PILImage.Image] = []
    batch_meta: list[tuple[int, str]] = []  # (t, crop_id)

    for crop_id in track(crop_ids, description=f"  Pos {pos}"):
        arr = crop_grp[crop_id]
        n_times = arr.shape[0]

        t_start = t_range[0] if t_range else 0
        t_end = min(t_range[1], n_times) if t_range else n_times

        for t in range(t_start, t_end):
            frame = np.array(arr[t, 0, 0])

            # Normalize uint16 → uint8 (same as dataset_cmd)
            lo, hi = float(frame.min()), float(frame.max())
            if hi > lo:
                normalized = ((frame - lo) / (hi - lo) * 255).astype(np.uint8)
            else:
                normalized = np.zeros_like(frame, dtype=np.uint8)

            img = PILImage.fromarray(normalized, mode="L").convert("RGB")
            batch_imgs.append(img)
            batch_meta.append((t, crop_id))

            # Process batch
            if len(batch_imgs) >= batch_size:
                preds = _run_batch(batch_imgs, model, processor, device)
                for (bt, bc), pred in zip(batch_meta, preds):
                    results.append({"t": bt, "crop": bc, "label": pred})
                batch_imgs.clear()
                batch_meta.clear()

    # Final partial batch
    if batch_imgs:
        preds = _run_batch(batch_imgs, model, processor, device)
        for (bt, bc), pred in zip(batch_meta, preds):
            results.append({"t": bt, "crop": bc, "label": pred})

    return results


def _run_batch(
    images: list[PILImage.Image],
    model: AutoModelForImageClassification,
    processor: AutoImageProcessor,
    device: torch.device,
) -> list[bool]:
    """Run model on a batch of PIL images. Returns list of bool (True=present)."""
    inputs = processor(images, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    preds = torch.argmax(outputs.logits, dim=-1).cpu().tolist()
    # label 1 = present = True, label 0 = absent = False
    return [bool(p) for p in preds]


@predict_app.command("run")
def run(
    config: Annotated[
        Path,
        typer.Option(
            exists=True,
            dir_okay=False,
            help="YAML config with zarr path, positions, and optional ranges.",
        ),
    ],
    model: Annotated[
        str,
        typer.Option(
            help="Local path or HuggingFace repo ID (e.g. keejkrej/mupattern-resnet18).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output CSV file path."),
    ],
    batch_size: Annotated[
        int,
        typer.Option(help="Inference batch size."),
    ] = 64,
) -> None:
    """Run inference on crops.zarr positions and write predictions as annotations CSV.

    Config YAML format::

        sources:
          - zarr: /path/to/crops.zarr
            pos: "150"
            t_range: [0, 50]       # optional, [start, end) timepoints
            crop_range: [0, 125]   # optional, [start, end) crop indices
    """
    with open(config) as f:
        cfg = yaml.safe_load(f)

    # Load model
    typer.echo(f"Loading model from {model}")
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    loaded_model = AutoModelForImageClassification.from_pretrained(str(model))
    loaded_model.to(device)
    loaded_model.eval()
    processor = AutoImageProcessor.from_pretrained(str(model))
    typer.echo(f"  Device: {device}")

    all_results: list[dict] = []

    for source in cfg["sources"]:
        zarr_path = Path(source["zarr"])
        pos = str(source["pos"])

        t_range = tuple(source["t_range"]) if "t_range" in source else None
        crop_range = tuple(source["crop_range"]) if "crop_range" in source else None

        n_crops_desc = (
            f"crops {crop_range[0]}-{crop_range[1]}" if crop_range else "all crops"
        )
        n_t_desc = f"t={t_range[0]}-{t_range[1]}" if t_range else "all t"
        typer.echo(f"Predicting pos {pos} ({n_crops_desc}, {n_t_desc})")

        results = _predict_position(
            zarr_path,
            pos,
            loaded_model,
            processor,
            device,
            batch_size,
            t_range,
            crop_range,
        )
        all_results.extend(results)

        n_present = sum(1 for r in results if r["label"])
        n_absent = len(results) - n_present
        typer.echo(
            f"  {len(results)} predictions ({n_present} present, {n_absent} absent)"
        )

    # Write CSV in musee annotation format: t,crop,label
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", newline="") as fh:
        fh.write("t,crop,label\n")
        for r in all_results:
            fh.write(f"{r['t']},{r['crop']},{str(r['label']).lower()}\n")

    typer.echo(f"\nWrote {len(all_results)} predictions to {output}")
