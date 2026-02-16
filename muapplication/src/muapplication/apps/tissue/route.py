from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ...common.jobs import get_job_manager
from ...common.types import JobRecord
from .core import run_analyze, run_plot, run_segment

router = APIRouter(tags=["tissue"])


class SegmentRequest(BaseModel):
    zarr_path: str
    pos: int
    channel_phase: int
    channel_fluorescence: int
    output: str


class AnalyzeRequest(BaseModel):
    zarr_path: str
    masks_path: str
    pos: int
    channel_fluorescence: int
    output: str


class PlotRequest(BaseModel):
    input: str
    output: str
    gfp_threshold: float


def _submit(kind: str, payload: dict, fn):
    mgr = get_job_manager()

    def runner(request, on_progress, on_log, cancel_event: threading.Event):
        on_log(f"Running {kind}")
        fn(request, on_progress)
        return {"output": request.get("output")}

    return mgr.submit(kind, payload, runner)


@router.post("/jobs/tissue.segment", response_model=JobRecord)
def tissue_segment(req: SegmentRequest) -> JobRecord:
    def fn(request: dict, on_progress):
        run_segment(
            Path(request["zarr_path"]),
            request["pos"],
            request["channel_phase"],
            request["channel_fluorescence"],
            Path(request["output"]),
            on_progress=on_progress,
        )

    return _submit("tissue.segment", req.model_dump(), fn)


@router.post("/jobs/tissue.analyze", response_model=JobRecord)
def tissue_analyze(req: AnalyzeRequest) -> JobRecord:
    def fn(request: dict, on_progress):
        run_analyze(
            Path(request["zarr_path"]),
            Path(request["masks_path"]),
            request["pos"],
            request["channel_fluorescence"],
            Path(request["output"]),
            on_progress=on_progress,
        )

    return _submit("tissue.analyze", req.model_dump(), fn)


@router.post("/jobs/tissue.plot", response_model=JobRecord)
def tissue_plot(req: PlotRequest) -> JobRecord:
    def fn(request: dict, _on_progress):
        run_plot(
            Path(request["input"]),
            Path(request["output"]),
            request["gfp_threshold"],
        )

    return _submit("tissue.plot", req.model_dump(), fn)
