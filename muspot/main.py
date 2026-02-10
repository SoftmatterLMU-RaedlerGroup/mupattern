"""muspot – detect fluorescent spots in micropattern crops using spotiflow.

Commands:
    muspot detect --config config.yaml --output spots.csv
    muspot plot --input spots.csv --output spots.png
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import matplotlib
import numpy as np
import pandas as pd
import typer
import yaml
import zarr
from rich.progress import track

matplotlib.use("Agg")
import matplotlib.pyplot as plt

app = typer.Typer(
    add_completion=False,
    help="Detect fluorescent spots in micropattern crops using spotiflow.",
)


@app.command()
def detect(
    config: Annotated[
        Path,
        typer.Option(
            exists=True,
            dir_okay=False,
            help="YAML config listing zarr sources with pos and channel.",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output CSV file path."),
    ],
    model: Annotated[
        str,
        typer.Option(help="Spotiflow pretrained model name."),
    ] = "general",
) -> None:
    """Detect spots per crop per timepoint and write a CSV."""
    from spotiflow.model import Spotiflow

    with open(config) as f:
        cfg = yaml.safe_load(f)

    typer.echo(f"Loading spotiflow model '{model}'...")
    sf_model = Spotiflow.from_pretrained(model)

    rows: list[tuple[int, str, int, float, float]] = []

    for source in cfg["sources"]:
        zarr_path = Path(source["zarr"])
        pos = int(source["pos"])
        channel = int(source["channel"])

        typer.echo(f"Processing pos {pos:03d}, channel {channel} from {zarr_path}")

        store = zarr.DirectoryStore(str(zarr_path))
        root = zarr.open_group(store, mode="r")
        crop_grp = root[f"pos/{pos:03d}/crop"]
        crop_ids = sorted(crop_grp.keys())

        for crop_id in track(crop_ids, description=f"  Pos {pos:03d}"):
            arr = crop_grp[crop_id]
            n_times = arr.shape[0]

            for t in range(n_times):
                frame = np.array(arr[t, channel, 0])
                spots, details = sf_model.predict(frame)

                for spot_idx, (y, x) in enumerate(spots):
                    rows.append((t, crop_id, spot_idx, float(y), float(x)))

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", newline="") as fh:
        fh.write("t,crop,spot,y,x\n")
        for t, crop, spot, y, x in rows:
            fh.write(f"{t},{crop},{spot},{y:.2f},{x:.2f}\n")

    typer.echo(f"Wrote {len(rows)} rows to {output}")


@app.command()
def plot(
    input: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            dir_okay=False,
            help="CSV from 'muspot detect' (t,crop,spot,y,x).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output plot image path (e.g. spots.png)."),
    ],
) -> None:
    """Plot spot count over time for every crop."""
    df = pd.read_csv(input, dtype={"crop": str})
    counts = df.groupby(["t", "crop"]).size().reset_index(name="count")
    n_crops = counts["crop"].nunique()
    max_t = counts["t"].max()
    typer.echo(f"Loaded {len(df)} spots, {n_crops} crops, t=0..{max_t}")

    fig, ax = plt.subplots(figsize=(6, 4))

    for _crop_id, group in counts.groupby("crop"):
        group = group.sort_values("t")
        ax.plot(group["t"], group["count"], linewidth=0.5, alpha=0.4)

    ax.set_xlabel("t")
    ax.set_ylabel("spot count")
    ax.set_title("Spots per crop over time")
    ax.set_xlim(0, max_t)

    output.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output, dpi=150, bbox_inches="tight")
    typer.echo(f"Saved plot to {output}")


if __name__ == "__main__":
    app()
