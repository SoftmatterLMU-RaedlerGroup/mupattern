from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["queued", "running", "succeeded", "failed", "canceled"]


class ProgressEvent(BaseModel):
    progress: float = Field(ge=0.0, le=1.0)
    message: str
    timestamp: datetime


class TaskRecord(BaseModel):
    id: str
    kind: str
    status: TaskStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    request: dict
    result: dict | None = None
    error: str | None = None
    logs: list[str] = Field(default_factory=list)
    progress_events: list[ProgressEvent] = Field(default_factory=list)
