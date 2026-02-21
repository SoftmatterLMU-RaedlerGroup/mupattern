from __future__ import annotations

from pathlib import Path

import zarr


def open_zarr_group(path: Path, mode: str = "r") -> zarr.Group:
    store = zarr.DirectoryStore(str(path))
    return zarr.open_group(store, mode=mode)
