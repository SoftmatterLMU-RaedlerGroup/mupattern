"""Task management API: list, get, logs, cancel, and SSE stream."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..common.tasks import get_task_manager
from ..common.types import TaskRecord
from .models import CancelResponse, TaskListResponse

router = APIRouter(tags=["tasks"])


@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(status: str | None = None) -> TaskListResponse:
    mgr = get_task_manager()
    if status is not None and status not in {"queued", "running", "succeeded", "failed", "canceled"}:
        raise HTTPException(status_code=400, detail=f"Invalid status {status}")
    return TaskListResponse(tasks=mgr.list(status=status))


@router.get("/tasks/{task_id}", response_model=TaskRecord)
def get_task(task_id: str) -> TaskRecord:
    mgr = get_task_manager()
    rec = mgr.get(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="task not found")
    return rec


@router.get("/tasks/{task_id}/logs")
def get_task_logs(task_id: str) -> dict:
    mgr = get_task_manager()
    rec = mgr.get(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="task not found")
    return {"task_id": task_id, "logs": rec.logs}


@router.get("/tasks/{task_id}/stream")
def stream_task(task_id: str) -> StreamingResponse:
    """Stream task progress and logs via Server-Sent Events until task completes."""

    async def event_generator():
        mgr = get_task_manager()
        last_idx = 0
        while True:
            rec = mgr.get(task_id)
            if rec is None:
                yield f"data: {{}}\n\n"
                yield f"data: {{\"done\": true, \"status\": \"failed\", \"error\": \"task not found\"}}\n\n"
                return

            # Yield any new progress events since last check
            for ev in rec.progress_events[last_idx:]:
                payload = {"progress": ev.progress, "message": ev.message}
                yield f"data: {json.dumps(payload)}\n\n"

            last_idx = len(rec.progress_events)

            if rec.status in ("succeeded", "failed", "canceled"):
                payload = {"done": True, "status": rec.status}
                if rec.error:
                    payload["error"] = rec.error
                yield f"data: {json.dumps(payload)}\n\n"
                return

            await asyncio.sleep(0.2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/tasks/{task_id}/cancel", response_model=CancelResponse)
def cancel_task(task_id: str) -> CancelResponse:
    mgr = get_task_manager()
    ok = mgr.cancel(task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="task not found")
    return CancelResponse(task_id=task_id, canceled=True)
