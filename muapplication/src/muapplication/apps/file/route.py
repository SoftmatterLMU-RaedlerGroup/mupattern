from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ...common.jobs import get_job_manager
from ...common.types import JobRecord
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
    mgr = get_job_manager()

    def runner(request, on_progress, on_log, cancel_event: threading.Event):
        on_log(f"Running {kind}")
        fn(request, on_progress)
        return {"output": request.get("output")}

    return mgr.submit(kind, payload, runner)


@router.post("/jobs/file.convert", response_model=JobRecord)
def file_convert(req: ConvertRequest) -> JobRecord:
    def fn(request: dict, on_progress):
        run_convert(
            Path(request["input"]),
            request["pos"],
            request["time"],
            Path(request["output"]),
            on_progress=on_progress,
        )

    return _submit("file.convert", req.model_dump(), fn)


@router.post("/jobs/file.crop", response_model=JobRecord)
def file_crop(req: CropRequest) -> JobRecord:
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


@router.post("/jobs/file.movie", response_model=JobRecord)
def file_movie(req: MovieRequest) -> JobRecord:
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
