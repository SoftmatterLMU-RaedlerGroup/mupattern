from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ...common.tasks import get_task_manager
from ...common.types import TaskRecord
from .core import run_convert, run_crop, run_movie

router = APIRouter(tags=["file"])


class ConvertRequest(BaseModel):
    input: str
    pos: str
    time: str
    output: str


class CropRequest(BaseModel):
    input_dir: str
    pos: int
    bbox: str
    output: str
    background: bool


class MovieRequest(BaseModel):
    input_zarr: str
    pos: int
    crop: int
    channel: int
    time: str
    output: str
    fps: int
    colormap: str
    spots: str | None = None


def _submit(kind: str, payload: dict, fn):
    mgr = get_task_manager()

    def runner(request, on_progress, on_log, cancel_event: threading.Event):
        on_log(f"Running {kind}")
        fn(request, on_progress)
        return {"output": request.get("output")}

    return mgr.submit(kind, payload, runner)


@router.post("/tasks/file.convert", response_model=TaskRecord)
def file_convert(req: ConvertRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_convert(
            Path(request["input"]),
            request["pos"],
            request["time"],
            Path(request["output"]),
            on_progress=on_progress,
        )

    return _submit("file.convert", req.model_dump(), fn)


@router.post("/tasks/file.crop", response_model=TaskRecord)
def file_crop(req: CropRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_crop(
            Path(request["input_dir"]),
            request["pos"],
            Path(request["bbox"]),
            Path(request["output"]),
            request["background"],
            on_progress=on_progress,
        )

    return _submit("file.crop", req.model_dump(), fn)


@router.post("/tasks/file.movie", response_model=TaskRecord)
def file_movie(req: MovieRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_movie(
            Path(request["input_zarr"]),
            request["pos"],
            request["crop"],
            request["channel"],
            request["time"],
            Path(request["output"]),
            request["fps"],
            request["colormap"],
            Path(request["spots"]) if request.get("spots") else None,
            on_progress=on_progress,
        )

    return _submit("file.movie", req.model_dump(), fn)
