# Rules

- Use `bun` for JavaScript/TypeScript projects (not npm/yarn/pnpm)
- Use `uv` for Python projects (not pip/poetry/pipx)
- CLI args should be as mandatory as possible (no defaults) so users understand the full potential of the app

## Project structure

- **Root** `pyproject.toml` defines a uv workspace; Python package: `muapplication`
- Run Python CLIs from repo root: `uv run muapplication --help` and domain subcommands like `uv run muapplication file --help`.
- **muapplication** domains: `file` (convert, crop), `kill` (dataset, train, predict, clean, plot), `expression` (analyze, plot), `tissue` (segment, analyze, plot), `spot` (detect, plot).
- **crops.zarr** layout: `pos/{pos:03d}/crop/{crop_id}` arrays (T, C, Z, H, W); optional `pos/{pos:03d}/background` (T, C, Z) per-pixel. Expression CSV: `t,crop,intensity,area,background`. Tissue: `segment` writes **masks.zarr** (same pos/crop keys, arrays (T, H, W) uint32); `analyze` reads crops + masks, writes CSV `t,crop,cell,total_fluorescence,cell_area,background`; `plot` uses `(total_fluorescence/cell_area)-background > gfp_threshold` for GFP+.
- JS app (web): `mupattern` — lite web app (landing, register, see), deployed on Firebase; run with `bun run dev` from that directory
- JS app (desktop): `mustudio` — Electron workspace-first app; run with `bun run dev` from that directory

## Product direction

- `mupattern` is frozen/maintenance-only. Avoid feature work unless explicitly requested; only apply critical fixes/docs tweaks.
- New feature development should go to `mustudio`.

