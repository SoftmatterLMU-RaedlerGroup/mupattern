from __future__ import annotations

from pydantic import BaseModel

from ..common.types import JobRecord


class JobListResponse(BaseModel):
    jobs: list[JobRecord]


class CancelResponse(BaseModel):
    job_id: str
    canceled: bool
