from __future__ import annotations

from ..common.jobs import JobManager, get_job_manager


def get_jobs() -> JobManager:
    return get_job_manager()
