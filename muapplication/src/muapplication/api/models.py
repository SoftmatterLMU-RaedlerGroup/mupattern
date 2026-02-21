from __future__ import annotations

from pydantic import BaseModel

from ..common.types import TaskRecord


class TaskListResponse(BaseModel):
    tasks: list[TaskRecord]


class CancelResponse(BaseModel):
    task_id: str
    canceled: bool
