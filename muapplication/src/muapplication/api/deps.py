from __future__ import annotations

from ..common.tasks import TaskManager, get_task_manager


def get_tasks() -> TaskManager:
    return get_task_manager()
