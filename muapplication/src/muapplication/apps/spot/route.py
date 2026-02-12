from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ...common.jobs import get_job_manager
from ...common.types import JobRecord
from .core import run_detect, run_plot

router = APIRouter(tags=["spot"])


class DetectRequest(BaseModel):
    zarr_path: str
    pos: int
    channel: int
    output: str
    crop: str
    model: str


class PlotRequest(BaseModel):
    input: str
    output: str


def _submit(kind: str, payload: dict, fn):
    mgr = get_job_manager()

    def runner(request, on_progress, on_log, cancel_event: threading.Event):
        on_log(f"Running {kind}")
        fn(request, on_progress)
        return {"output": request.get("output")}

    return mgr.submit(kind, payload, runner)


@router.post("/jobs/spot.detect", response_model=JobRecord)
def spot_detect(req: DetectRequest) -> JobRecord:
    def fn(request: dict, on_progress):
        run_detect(
            Path(request["zarr_path"]),
            request["pos"],
            request["channel"],
            Path(request["output"]),
            crop_slice=request["crop"],
            model=request["model"],
            on_progress=on_progress,
        )

    return _submit("spot.detect", req.model_dump(), fn)


@router.post("/jobs/spot.plot", response_model=JobRecord)
def spot_plot(req: PlotRequest) -> JobRecord:
    def fn(request: dict, _on_progress):
        run_plot(Path(request["input"]), Path(request["output"]))

    return _submit("spot.plot", req.model_dump(), fn)
