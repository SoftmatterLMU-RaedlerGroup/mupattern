# Rules

- Use `bun` for JavaScript/TypeScript projects (not npm/yarn/pnpm)
- Use `uv` for Python projects (not pip/poetry/pipx)
- CLI args should be as mandatory as possible (no defaults) so users understand the full potential of the app

## Project structure

- **Root** `pyproject.toml` defines a uv workspace; Python package: `mupattern-py`
- Run Python CLIs from repo root: `uv run mupattern --help` and domain subcommands like `uv run mupattern crop --help`.
- **mupattern-py** (pure Python CLI, reference): Top-level inference: `convert`, `crop`, `movie`, `expression`, `kill`, `spot`, `tissue`. Python-only: `plot` (expression, kill, spot, tissue), `train kill` (train, export-onnx), `dataset kill`. `kill` runs predict then clean (monotonicity) in one pipeline. Prod code lives in mupattern-desktop (Rust binary + ONNX).
- **crops.zarr** layout (Zarr v3 only): `pos/{pos:03d}/crop/{crop_id}` arrays (T, C, Z, H, W); optional `pos/{pos:03d}/background` (T, C, Z) per-pixel. Expression CSV: `t,crop,intensity,area,background`. Tissue: `mupattern tissue` runs segment then analyze (writes **masks.zarr** + CSV `t,crop,cell,total_fluorescence,cell_area,background`); `plot tissue` uses `(total_fluorescence/cell_area)-background > gfp_threshold` for GFP+.
- JS app (web): `mupattern-web` — lite web app (landing, register, see), deployed on Firebase; run with `bun run dev` from that directory
- JS app (desktop): `mupattern-desktop` — Electron workspace-first app; run with `bun run dev` from that directory

## Product direction

- `mupattern-web` is frozen/maintenance-only. Avoid feature work unless explicitly requested; only apply critical fixes/docs tweaks.
- New feature development should go to `mupattern-desktop`.

