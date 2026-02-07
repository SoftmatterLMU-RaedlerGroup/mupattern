"""mucrop – crop micropattern positions from tiled microscopy data into zarr stacks.

Reads a bounding-box CSV (from mupattern export) and a folder of per-position
TIFFs, then writes one TCZYX zarr array per crop into a zarr
DirectoryStore.

Output layout::

    crops.zarr/
      pos/
        150/            # position 150
          crop/
            000/        # crop 0 – shape (T, C, Z, Y, X)
            001/        # crop 1
            ...
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Annotated

import numpy as np
import tifffile
import typer
import zarr
from rich.progress import track


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TIFF_RE = re.compile(r"img_channel(\d+)_position(\d+)_time(\d+)_z(\d+)\.tif")


def _discover_tiffs(pos_dir: Path) -> dict[tuple[int, int, int], Path]:
    """Return {(channel, time, z): path} for every TIFF in *pos_dir*."""
    index: dict[tuple[int, int, int], Path] = {}
    for p in sorted(pos_dir.iterdir()):
        m = _TIFF_RE.match(p.name)
        if m is None:
            continue
        c, _pos, t, z = (int(g) for g in m.groups())
        index[(c, t, z)] = p
    return index


def _axis_range(index: dict[tuple[int, int, int], Path]) -> tuple[int, int, int]:
    """Return (n_channels, n_times, n_z) from the discovered index."""
    cs = {k[0] for k in index}
    ts = {k[1] for k in index}
    zs = {k[2] for k in index}
    return len(cs), len(ts), len(zs)


def _read_bbox_csv(csv_path: Path) -> list[dict[str, int]]:
    """Parse the mupattern bbox CSV → list of {crop, x, y, w, h}."""
    rows: list[dict[str, int]] = []
    with open(csv_path, newline="") as fh:
        for row in csv.DictReader(fh):
            rows.append({k: int(v) for k, v in row.items()})
    return rows


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------


def crop_position(
    pos_dir: Path,
    pos: int,
    bboxes: list[dict[str, int]],
    output: Path,
) -> None:
    """Crop every bbox across all frames and write into *output* zarr store."""
    index = _discover_tiffs(pos_dir)
    if not index:
        raise typer.BadParameter(f"No TIFFs found in {pos_dir}")

    n_channels, n_times, n_z = _axis_range(index)
    typer.echo(f"Discovered {len(index)} TIFFs: T={n_times}, C={n_channels}, Z={n_z}")

    # Read one frame to get dtype
    sample = tifffile.imread(next(iter(index.values())))
    dtype = sample.dtype

    store = zarr.DirectoryStore(str(output))
    root = zarr.open_group(store, mode="a")
    crop_grp = root.require_group(f"pos/{pos:03d}/crop")

    n_crops = len(bboxes)
    typer.echo(f"Cropping {n_crops} crops …")

    # Pre-allocate zarr arrays for every crop
    arrays: list[zarr.Array] = []
    for i, bb in enumerate(bboxes):
        arr = crop_grp.zeros(
            f"{i:03d}",
            shape=(n_times, n_channels, n_z, bb["h"], bb["w"]),
            chunks=(1, 1, 1, bb["h"], bb["w"]),
            dtype=dtype,
            overwrite=True,
        )
        arr.attrs["axis_names"] = ["t", "c", "z", "y", "x"]
        arr.attrs["bbox"] = bb
        arrays.append(arr)

    # Stream TIFFs and fill crops
    sorted_keys = sorted(index.keys())  # (c, t, z) sorted
    for c, t, z in track(sorted_keys, description="Reading frames"):
        frame = tifffile.imread(index[(c, t, z)])
        for crop_idx, bb in enumerate(bboxes):
            x, y, w, h = bb["x"], bb["y"], bb["w"], bb["h"]
            arrays[crop_idx][t, c, z] = frame[y : y + h, x : x + w]

    typer.echo(f"Wrote {output}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

app = typer.Typer(add_completion=False)


@app.command()
def main(
    input_dir: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            file_okay=False,
            help="Root folder containing Pos* subdirectories.",
        ),
    ],
    pos: Annotated[
        int,
        typer.Option(help="Position number (e.g. 150 reads Pos150/)."),
    ],
    bbox: Annotated[
        Path,
        typer.Option(
            exists=True,
            dir_okay=False,
            help="Path to the bounding-box CSV exported by mupattern.",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output zarr store path (e.g. crops.zarr)."),
    ],
) -> None:
    """Crop pattern positions from microscopy data into a zarr store."""
    pos_dir = input_dir / f"Pos{pos}"
    if not pos_dir.is_dir():
        typer.echo(f"Error: Position directory not found: {pos_dir}", err=True)
        raise typer.Exit(code=1)

    bboxes = _read_bbox_csv(bbox)
    typer.echo(f"Loaded {len(bboxes)} bounding boxes from {bbox}")

    crop_position(pos_dir, pos, bboxes, output)


if __name__ == "__main__":
    app()
