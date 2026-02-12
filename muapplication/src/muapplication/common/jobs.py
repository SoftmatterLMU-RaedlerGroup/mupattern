from __future__ import annotations

import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from .types import JobRecord, JobStatus, ProgressEvent

JobRunner = Callable[[dict, Callable[[float, str], None], Callable[[str], None], threading.Event], dict]


class JobManager:
    def __init__(self, storage_dir: Path, max_workers: int = 2):
        self._storage_dir = storage_dir
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, JobRecord] = {}
        self._cancel_flags: dict[str, threading.Event] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers)

    def submit(self, kind: str, request: dict[str, Any], runner: JobRunner) -> JobRecord:
        now = datetime.now(UTC)
        job_id = uuid.uuid4().hex
        rec = JobRecord(
            id=job_id,
            kind=kind,
            status="queued",
            created_at=now,
            request=request,
        )
        cancel_event = threading.Event()

        with self._lock:
            self._jobs[job_id] = rec
            self._cancel_flags[job_id] = cancel_event
            self._persist(rec)

        self._executor.submit(self._run, job_id, runner)
        return rec

    def _run(self, job_id: str, runner: JobRunner) -> None:
        with self._lock:
            rec = self._jobs[job_id]
            rec.status = "running"
            rec.started_at = datetime.now(UTC)
            self._persist(rec)

        def on_progress(progress: float, message: str) -> None:
            with self._lock:
                live = self._jobs[job_id]
                live.progress_events.append(
                    ProgressEvent(progress=progress, message=message, timestamp=datetime.now(UTC))
                )
                self._persist(live)

        def on_log(message: str) -> None:
            with self._lock:
                live = self._jobs[job_id]
                live.logs.append(message)
                self._persist(live)

        try:
            cancel_event = self._cancel_flags[job_id]
            result = runner(rec.request, on_progress, on_log, cancel_event)
            with self._lock:
                live = self._jobs[job_id]
                live.status = "canceled" if cancel_event.is_set() else "succeeded"
                live.result = result
                live.finished_at = datetime.now(UTC)
                self._persist(live)
        except Exception as exc:
            with self._lock:
                live = self._jobs[job_id]
                live.status = "failed"
                live.error = str(exc)
                live.finished_at = datetime.now(UTC)
                self._persist(live)

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self, status: JobStatus | None = None) -> list[JobRecord]:
        with self._lock:
            vals = list(self._jobs.values())
        if status is None:
            return vals
        return [j for j in vals if j.status == status]

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            ev = self._cancel_flags.get(job_id)
            if ev is None:
                return False
            ev.set()
            rec = self._jobs[job_id]
            rec.logs.append("Cancellation requested")
            self._persist(rec)
            return True

    def _persist(self, rec: JobRecord) -> None:
        p = self._storage_dir / f"{rec.id}.json"
        p.write_text(rec.model_dump_json(indent=2), encoding="utf-8")


_manager: JobManager | None = None


def get_job_manager() -> JobManager:
    global _manager
    if _manager is None:
        _manager = JobManager(Path(".muapplication/jobs"))
    return _manager
