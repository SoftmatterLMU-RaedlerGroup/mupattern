"""muapplication tissue – segment multi-cell crops with Cellpose v4, measure per-cell GFP fluorescence.

Commands:
    muapplication tissue segment --zarr crops.zarr --pos 0 --channel-phase 0 --channel-fluorescence 1 --output masks.zarr
    muapplication tissue analyze --zarr crops.zarr --masks masks.zarr --pos 0 --channel-fluorescence 1 --output tissue.csv
    muapplication tissue plot --input tissue.csv --output tissue.png --gfp-threshold 100.0
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from ..apps.tissue.core import run_analyze, run_plot, run_segment

app = typer.Typer(
    add_completion=False,
    help="Segment crops with Cellpose v4 (phase + fluorescence), measure per-cell total fluorescence.",
)


def _progress_echo(progress: float, message: str) -> None:
    typer.echo(message)


@app.command()
def segment(
    zarr_path: Annotated[
        Path,
        typer.Option("--zarr", help="Path to crops zarr store (e.g. crops.zarr)."),
    ],
    pos: Annotated[
        int,
        typer.Option("--pos", help="Position index."),
    ],
    channel_phase: Annotated[
        int,
        typer.Option("--channel-phase", help="Channel index for phase contrast."),
    ],
    channel_fluorescence: Annotated[
        int,
        typer.Option("--channel-fluorescence", help="Channel index for fluorescence (e.g. GFP)."),
    ],
    output: Annotated[
        Path,
        typer.Option("--output", help="Output masks zarr path (e.g. masks.zarr), same layout as crops."),
    ],
) -> None:
    """Run Cellpose v4 on each crop/frame, save segmentation masks to masks.zarr."""
    typer.echo(
        f"Segmenting pos {pos:03d}, channels phase={channel_phase} fluo={channel_fluorescence} from {zarr_path}"
    )
    run_segment(
        zarr_path,
        pos,
        channel_phase,
        channel_fluorescence,
        output,
        on_progress=_progress_echo,
    )
    typer.echo(f"Wrote masks to {output}")


@app.command()
def analyze(
    zarr_path: Annotated[
        Path,
        typer.Option("--zarr", help="Path to crops zarr store (e.g. crops.zarr)."),
    ],
    masks_path: Annotated[
        Path,
        typer.Option("--masks", help="Path to masks zarr from 'tissue segment' (e.g. masks.zarr)."),
    ],
    pos: Annotated[
        int,
        typer.Option("--pos", help="Position index."),
    ],
    channel_fluorescence: Annotated[
        int,
        typer.Option("--channel-fluorescence", help="Channel index for fluorescence (e.g. GFP)."),
    ],
    output: Annotated[
        Path,
        typer.Option("--output", help="Output CSV path (t,crop,cell,total_fluorescence,cell_area,background)."),
    ],
) -> None:
    """Load crops and masks zarr; compute per-cell total fluorescence, write CSV (no segmentation)."""
    typer.echo(f"Analyzing pos {pos:03d}, fluo channel {channel_fluorescence} from {zarr_path} + {masks_path}")
    run_analyze(
        zarr_path,
        masks_path,
        pos,
        channel_fluorescence,
        output,
        on_progress=_progress_echo,
    )
    typer.echo(f"Wrote {output}")


@app.command()
def plot(
    input: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            dir_okay=False,
            help="CSV from 'tissue analyze' (t,crop,cell,total_fluorescence,cell_area,background).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option("--output", help="Output plot image path (e.g. tissue.png)."),
    ],
    gfp_threshold: Annotated[
        float,
        typer.Option("--gfp-threshold", help="GFP+ when (total_fluorescence/cell_area) - background > this."),
    ],
) -> None:
    """Plot GFP+ count and mean/median mean intensity above background over time."""
    typer.echo(f"Loaded {input}, GFP threshold={gfp_threshold}")
    run_plot(input, output, gfp_threshold)
    typer.echo(f"Saved plot to {output}")


def main() -> None:
    app()
