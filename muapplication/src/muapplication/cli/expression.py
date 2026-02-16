"""muapplication expression – measure fluorescence expression in micropattern crops.

Commands:
    muexpression analyze --zarr crops.zarr --pos 0 --channel 1 --output expression.csv
    muexpression plot --input expression.csv --output ./plots
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer

from ..apps.expression.core import run_analyze, run_plot

app = typer.Typer(
    add_completion=False,
    help="Measure fluorescence expression in micropattern crops.",
)


def _progress_echo(progress: float, message: str) -> None:
    typer.echo(message)


@app.command()
def analyze(
    zarr_path: Annotated[
        Path,
        typer.Option("--zarr", help="Path to zarr store."),
    ],
    pos: Annotated[
        int,
        typer.Option(help="Position number."),
    ],
    channel: Annotated[
        int,
        typer.Option(help="Channel number."),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output CSV file path."),
    ],
) -> None:
    """Sum pixel intensities per crop per timepoint and write a CSV."""
    typer.echo(f"Processing pos {pos:03d}, channel {channel} from {zarr_path}")
    run_analyze(zarr_path, pos, channel, output, on_progress=_progress_echo)


@app.command()
def plot(
    input: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            dir_okay=False,
            help="CSV from 'muexpression analyze' (t,crop,intensity,area,background).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output directory for the two plots (intensity.png, background_corrected_total_fluor.png)."),
    ],
) -> None:
    """Plot raw intensity and background-corrected total fluor per crop (two square plots)."""
    typer.echo(f"Loaded {input}")
    run_plot(input, output)
    typer.echo(f"Saved plots to {output / 'intensity.png'} and {output / 'background_corrected_total_fluor.png'}")


def main() -> None:
    app()
