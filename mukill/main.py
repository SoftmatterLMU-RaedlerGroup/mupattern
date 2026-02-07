"""mukill – analyze and clean kill curve predictions.

Commands:
    mukill plot   --input predictions.csv --output plot.png
    mukill clean  --input predictions.csv --output cleaned.csv
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import typer

app = typer.Typer(
    add_completion=False, help="Analyze and clean kill curve predictions."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load(csv_path: Path) -> pd.DataFrame:
    """Load a predictions/annotations CSV (t,crop,label) into a DataFrame."""
    df = pd.read_csv(csv_path, dtype={"crop": str})
    # pandas may auto-parse true/false as bool, or keep as string
    if df["label"].dtype == object:
        df["label"] = df["label"].map({"true": True, "false": False})
    else:
        df["label"] = df["label"].astype(bool)
    return df


def _find_violations(df: pd.DataFrame) -> pd.DataFrame:
    """Find crops that violate monotonicity (once absent, must stay absent).

    Returns a DataFrame of violating rows — the first `true` after a `false`.
    """
    violations = []
    for crop_id, group in df.groupby("crop"):
        group = group.sort_values("t")
        seen_false = False
        for _, row in group.iterrows():
            if not row["label"]:
                seen_false = True
            elif seen_false:
                violations.append(row)
    if violations:
        return pd.DataFrame(violations)
    return pd.DataFrame(columns=df.columns)


def _clean(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Enforce monotonicity: once a crop goes false, force all later frames false.

    Returns (cleaned_df, report_df) where report_df lists corrected rows.
    """
    corrected = []
    rows = []

    for crop_id, group in df.groupby("crop"):
        group = group.sort_values("t").copy()
        seen_false = False

        for idx, row in group.iterrows():
            if not row["label"]:
                seen_false = True
                rows.append(row)
            elif seen_false:
                corrected.append(row.to_dict())
                new_row = row.copy()
                new_row["label"] = False
                rows.append(new_row)
            else:
                rows.append(row)

    cleaned = pd.DataFrame(rows)
    report = pd.DataFrame(corrected) if corrected else pd.DataFrame(columns=df.columns)
    return cleaned, report


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


@app.command()
def plot(
    input: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            dir_okay=False,
            help="Predictions CSV (t,crop,label).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output plot image path (e.g. plot.png)."),
    ],
) -> None:
    """Plot kill curve: number of present cells over time."""
    df = _load(input)

    n_crops = df["crop"].nunique()
    max_t = df["t"].max()
    typer.echo(f"Loaded {len(df)} predictions, {n_crops} crops, t=0..{max_t}")

    # Count present cells per timepoint
    n_present = df.groupby("t")["label"].sum().sort_index()

    # Compute death time per crop: first t where label is false, ignoring t=0.
    # A crop absent at t=0 never had a cell — that's not a death event.
    death_times = []
    empty_at_t0 = 0
    for crop_id, group in df.groupby("crop"):
        group = group.sort_values("t")
        first_false = group.loc[~group["label"], "t"]
        if len(first_false) > 0:
            t_death = first_false.iloc[0]
            if t_death == 0:
                empty_at_t0 += 1  # no cell was ever present
            else:
                death_times.append(t_death)

    fig, (ax_curve, ax_hist) = plt.subplots(
        1,
        2,
        figsize=(12, 4),
        gridspec_kw={"width_ratios": [2, 1], "wspace": 0.3},
    )

    # Kill curve
    ax_curve.plot(n_present.index, n_present.values, color="steelblue", linewidth=2)
    ax_curve.fill_between(
        n_present.index, 0, n_present.values, alpha=0.15, color="steelblue"
    )
    ax_curve.set_xlabel("t")
    ax_curve.set_ylabel("n cells")
    ax_curve.set_title("Kill curve")
    ax_curve.set_xlim(0, max_t)
    ax_curve.set_ylim(0, None)

    # Death time histogram
    if death_times:
        ax_hist.hist(
            death_times,
            bins=range(1, max_t + 2),
            color="tomato",
            edgecolor="white",
            alpha=0.8,
        )
    ax_hist.set_xlabel("t (death)")
    ax_hist.set_ylabel("n crops")
    ax_hist.set_title("Death time distribution")
    ax_hist.set_xlim(0, max_t)

    n_never = n_crops - len(death_times) - empty_at_t0
    typer.echo(
        f"Deaths: {len(death_times)} crops died, {n_never} survived, {empty_at_t0} empty at t=0"
    )

    plt.savefig(output, dpi=150, bbox_inches="tight")
    typer.echo(f"Saved plot to {output}")

    # Summary
    violations = _find_violations(df)
    n_noisy = violations["crop"].nunique() if len(violations) > 0 else 0
    typer.echo(f"Violations: {len(violations)} rows across {n_noisy} crops")


@app.command()
def clean(
    input: Annotated[
        Path,
        typer.Option(
            "--input",
            exists=True,
            dir_okay=False,
            help="Predictions CSV (t,crop,label).",
        ),
    ],
    output: Annotated[
        Path,
        typer.Option(help="Output cleaned CSV path."),
    ],
) -> None:
    """Clean predictions by enforcing monotonicity (once absent, stays absent)."""
    df = _load(input)
    typer.echo(f"Loaded {len(df)} predictions")

    violations = _find_violations(df)
    n_violations = len(violations)
    noisy_crops = violations["crop"].unique() if n_violations > 0 else []

    if n_violations == 0:
        typer.echo("No violations found, already clean.")
        df["label"] = df["label"].apply(lambda x: "true" if x else "false")
        df.to_csv(output, index=False)
        typer.echo(f"Wrote {len(df)} rows to {output}")
        return

    typer.echo(f"Found {n_violations} violations across {len(noisy_crops)} crops:")
    for crop_id in sorted(noisy_crops):
        crop_violations = violations[violations["crop"] == crop_id]
        ts = sorted(crop_violations["t"].tolist())
        typer.echo(f"  crop {crop_id}: resurrects at t={ts}")

    cleaned, report = _clean(df)
    typer.echo(f"Corrected {len(report)} rows (forced to absent)")

    cleaned["label"] = cleaned["label"].apply(lambda x: "true" if x else "false")
    cleaned.to_csv(output, index=False)
    typer.echo(f"Wrote {len(cleaned)} rows to {output}")


if __name__ == "__main__":
    app()
