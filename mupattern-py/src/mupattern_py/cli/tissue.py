"""muapplication tissue – segment multi-cell crops, measure per-cell GFP fluorescence.

Commands:
    # cellpose or cellsam (phase + fluorescence):
    muapplication tissue segment --zarr crops.zarr --pos 0 --method cellpose --channel-phase 0 --channel-fluorescence 1 --output masks.zarr
    muapplication tissue segment --zarr crops.zarr --pos 0 --method cellsam --channel-phase 0 --channel-fluorescence 1 --output masks.zarr
    # watershed (fluo-only):
    muapplication tissue segment --zarr crops.zarr --pos 0 --method watershed --channel-fluorescence 1 --output masks.zarr
    muapplication tissue analyze --zarr crops.zarr --masks masks.zarr --pos 0 --channel-fluorescence 1 --output tissue.csv
    muapplication tissue plot --input tissue.csv --output tissue.png --gfp-threshold 100.0
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from ..apps.tissue.core import run_analyze, run_plot, run_segment, run_segment_watershed

app = typer.Typer(
    add_completion=False,
    help="Segment crops: method cellpose | cellsam | watershed; measure per-cell total fluorescence.",
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
    channel_fluorescence: Annotated[
        int,
        typer.Option("--channel-fluorescence", help="Channel index for fluorescence (e.g. GFP)."),
    ],
    output: Annotated[
        Path,
        typer.Option("--output", help="Output masks zarr path (e.g. masks.zarr), same layout as crops."),
    ],
    method: Annotated[
        str,
        typer.Option("--method", help="Segment method: 'cellpose' | 'cellsam' | 'watershed'."),
    ] = "cellpose",
    channel_phase: Annotated[
        int | None,
        typer.Option("--channel-phase", help="Channel index for phase contrast (required when method=cellpose or method=cellsam)."),
    ] = None,
    sigma: Annotated[
        float,
        typer.Option("--sigma", help="Gaussian blur sigma before thresholding (watershed method)."),
    ] = 2.0,
    margin: Annotated[
        float,
        typer.Option("--margin", help="Add this to background for threshold (watershed method: fluo > background + margin)."),
    ] = 0.0,
    min_distance: Annotated[
        int,
        typer.Option("--min-distance", help="Minimum pixels between watershed seeds (watershed method)."),
    ] = 5,
) -> None:
    """Segment each crop/frame; save masks to masks.zarr. Methods: cellpose (phase+fluo), cellsam (phase+fluo), watershed (fluo-only)."""
    if method in ("cellpose", "cellsam"):
        if channel_phase is None:
            typer.echo(f"When --method {method}, --channel-phase is required.", err=True)
            raise typer.Exit(1)
        typer.echo(
            f"Segmenting pos {pos:03d}, method={method}, phase={channel_phase} fluo={channel_fluorescence} from {zarr_path}"
        )
        run_segment(
            zarr_path,
            pos,
            channel_phase,
            channel_fluorescence,
            output,
            backend=method,
            on_progress=_progress_echo,
        )
    elif method == "watershed":
        typer.echo(
            f"Segmenting pos {pos:03d}, method=watershed (fluo-only), channel={channel_fluorescence} from {zarr_path}"
        )
        run_segment_watershed(
            zarr_path,
            pos,
            channel_fluorescence,
            output,
            sigma=sigma,
            margin=margin,
            min_distance=min_distance,
            on_progress=_progress_echo,
        )
    else:
        typer.echo(f"Unknown --method {method!r}. Use 'cellpose', 'cellsam', or 'watershed'.", err=True)
        raise typer.Exit(1)
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
        typer.Option("--output", help="Output directory for the two plots (gfp_count.png, median_fluorescence.png)."),
    ],
    gfp_threshold: Annotated[
        float,
        typer.Option("--gfp-threshold", help="GFP+ when (total_fluorescence/cell_area) - background > this."),
    ],
) -> None:
    """Plot GFP+ count and median fluorescence per crop over time (two square plots)."""
    typer.echo(f"Loaded {input}, GFP threshold={gfp_threshold}")
    run_plot(input, output, gfp_threshold)
    typer.echo(f"Saved plots to {output / 'gfp_count.png'} and {output / 'median_fluorescence.png'}")


def main() -> None:
    app()
