from __future__ import annotations

import threading
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ...common.tasks import get_task_manager
from ...common.types import TaskRecord
from .core import run_clean, run_dataset, run_plot, run_predict, run_train

router = APIRouter(tags=["kill"])


class DatasetRequest(BaseModel):
    zarr_path: str
    pos: int
    annotations: str
    output: str


class TrainRequest(BaseModel):
    dataset: str
    output: str
    epochs: int
    batch_size: int
    lr: float
    split: float


class PredictRequest(BaseModel):
    zarr_path: str
    pos: int
    model: str
    output: str
    batch_size: int
    t_start: int | None = None
    t_end: int | None = None
    crop_start: int | None = None
    crop_end: int | None = None


class PlotRequest(BaseModel):
    input: str
    output: str


class CleanRequest(BaseModel):
    input: str
    output: str


def _submit(kind: str, payload: dict, fn):
    mgr = get_task_manager()

    def runner(request, on_progress, on_log, cancel_event: threading.Event):
        on_log(f"Running {kind}")
        fn(request, on_progress)
        return {"output": request.get("output")}

    return mgr.submit(kind, payload, runner)


@router.post("/tasks/kill.dataset", response_model=TaskRecord)
def kill_dataset(req: DatasetRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_dataset(Path(request["zarr_path"]), request["pos"], Path(request["annotations"]), Path(request["output"]), on_progress=on_progress)

    return _submit("kill.dataset", req.model_dump(), fn)


@router.post("/tasks/kill.train", response_model=TaskRecord)
def kill_train(req: TrainRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_train(Path(request["dataset"]), Path(request["output"]), request["epochs"], request["batch_size"], request["lr"], request["split"], on_progress=on_progress)

    return _submit("kill.train", req.model_dump(), fn)


@router.post("/tasks/kill.predict", response_model=TaskRecord)
def kill_predict(req: PredictRequest) -> TaskRecord:
    def fn(request: dict, on_progress):
        run_predict(
            Path(request["zarr_path"]),
            request["pos"],
            request["model"],
            Path(request["output"]),
            batch_size=request["batch_size"],
            t_start=request.get("t_start"),
            t_end=request.get("t_end"),
            crop_start=request.get("crop_start"),
            crop_end=request.get("crop_end"),
            on_progress=on_progress,
        )

    return _submit("kill.predict", req.model_dump(), fn)


@router.post("/tasks/kill.plot", response_model=TaskRecord)
def kill_plot(req: PlotRequest) -> TaskRecord:
    def fn(request: dict, _on_progress):
        run_plot(Path(request["input"]), Path(request["output"]))

    return _submit("kill.plot", req.model_dump(), fn)


@router.post("/tasks/kill.clean", response_model=TaskRecord)
def kill_clean(req: CleanRequest) -> TaskRecord:
    def fn(request: dict, _on_progress):
        run_clean(Path(request["input"]), Path(request["output"]))

    return _submit("kill.clean", req.model_dump(), fn)
