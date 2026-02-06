"""mutrain dataset create – build a HuggingFace Dataset from crops.zarr + annotations."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Annotated

import numpy as np
import typer
import yaml
import zarr
from datasets import Dataset, Features, Image, ClassLabel, Value
from PIL import Image as PILImage
from rich.progress import track

dataset_app = typer.Typer(help="Dataset management commands.")


def _load_annotations(csv_path: Path) -> dict[str, bool]:
    """Load annotations CSV → {\"t:cropId\": bool}."""
    annotations: dict[str, bool] = {}
    with open(csv_path, newline="") as fh:
        for row in csv.DictReader(fh):
            key = f"{row['t']}:{row['crop']}"
            annotations[key] = row["label"] == "true"
    return annotations


def _build_examples(
    zarr_path: Path,
    pos: str,
    annotations: dict[str, bool],
) -> list[dict]:
    """Read crops from zarr and pair with annotations."""
    store = zarr.DirectoryStore(str(zarr_path))
    root = zarr.open_group(store, mode="r")

    crop_grp = root[f"pos/{pos}/crop"]
    crop_ids = sorted(crop_grp.keys())

    examples = []
    for crop_id in track(crop_ids, description=f"  Pos {pos}"):
        arr = crop_grp[crop_id]
        n_times = arr.shape[0]

        for t in range(n_times):
            key = f"{t}:{crop_id}"
            if key not in annotations:
                continue

            # Read the spatial slice: arr[t, 0, 0, :, :] → (H, W) uint16
            frame = np.array(arr[t, 0, 0])

            # Convert uint16 to uint8 for PIL (normalize to 0-255)
            lo, hi = float(frame.min()), float(frame.max())
            if hi > lo:
                normalized = ((frame - lo) / (hi - lo) * 255).astype(np.uint8)
            else:
                normalized = np.zeros_like(frame, dtype=np.uint8)

            img = PILImage.fromarray(normalized, mode="L")

            examples.append(
                {
                    "image": img,
                    "label": int(annotations[key]),
                    "pos": pos,
                    "crop": crop_id,
                    "t": t,
                }
            )

    return examples


@dataset_app.command("create")
def create(
    config: Annotated[
        Path,
        typer.Option(
            exists=True,
            dir_okay=False,
            help="YAML config mapping zarr stores + positions to annotation CSVs.",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output directory for the HuggingFace Dataset."),
    ],
) -> None:
    """Create a HuggingFace Dataset from crops.zarr + annotations CSV."""
    with open(config) as f:
        cfg = yaml.safe_load(f)

    all_examples: list[dict] = []

    for source in cfg["sources"]:
        zarr_path = Path(source["zarr"])
        pos = str(source["pos"])
        ann_path = Path(source["annotations"])

        typer.echo(f"Loading pos {pos} from {zarr_path}")
        annotations = _load_annotations(ann_path)
        typer.echo(f"  {len(annotations)} annotations from {ann_path}")

        examples = _build_examples(zarr_path, pos, annotations)
        all_examples.extend(examples)
        typer.echo(f"  {len(examples)} labeled samples")

    if not all_examples:
        typer.echo("Error: no labeled samples found.", err=True)
        raise typer.Exit(code=1)

    # Count class balance
    n_pos = sum(1 for e in all_examples if e["label"] == 1)
    n_neg = len(all_examples) - n_pos
    typer.echo(
        f"\nTotal: {len(all_examples)} samples ({n_pos} positive, {n_neg} negative)"
    )

    features = Features(
        {
            "image": Image(),
            "label": ClassLabel(names=["absent", "present"]),
            "pos": Value("string"),
            "crop": Value("string"),
            "t": Value("int32"),
        }
    )

    ds = Dataset.from_list(all_examples, features=features)
    ds.save_to_disk(str(output))
    typer.echo(f"Saved dataset to {output}")
