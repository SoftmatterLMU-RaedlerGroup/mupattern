from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..common.jobs import get_job_manager
from ..common.types import JobRecord
from .models import CancelResponse, JobListResponse

router = APIRouter(tags=["jobs"])


@router.get("/jobs", response_model=JobListResponse)
def list_jobs(status: str | None = None) -> JobListResponse:
    mgr = get_job_manager()
    if status is not None and status not in {"queued", "running", "succeeded", "failed", "canceled"}:
        raise HTTPException(status_code=400, detail=f"Invalid status {status}")
    return JobListResponse(jobs=mgr.list(status=status))


@router.get("/jobs/{job_id}", response_model=JobRecord)
def get_job(job_id: str) -> JobRecord:
    mgr = get_job_manager()
    rec = mgr.get(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="job not found")
    return rec


@router.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: str) -> dict:
    mgr = get_job_manager()
    rec = mgr.get(job_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="job not found")
    return {"job_id": job_id, "logs": rec.logs}


@router.post("/jobs/{job_id}/cancel", response_model=CancelResponse)
def cancel_job(job_id: str) -> CancelResponse:
    mgr = get_job_manager()
    ok = mgr.cancel(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="job not found")
    return CancelResponse(job_id=job_id, canceled=True)
