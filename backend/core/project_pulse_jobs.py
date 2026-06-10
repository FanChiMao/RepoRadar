"""Background-job state for AI Schedule runs that rebuild the index first.

When a schedule has ``rebuild_index_before_send`` on, Send Now / Preview kick off
a background job (sync → reindex → generate → optionally send) and return a
``job_id`` immediately so the HTTP request never blocks on the long reindex. The
frontend polls ``get_job`` for live phase/progress, then the final result.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

from .config_store import data_dir
from .utils import read_json, write_json

JOBS_PATH = data_dir() / "ai_report_jobs.json"
MAX_JOBS = 50

_LOCK = threading.Lock()


def _load() -> dict[str, Any]:
    payload = read_json(JOBS_PATH, {"jobs": {}})
    return payload if isinstance(payload, dict) else {"jobs": {}}


def _save(payload: dict[str, Any]) -> None:
    write_json(JOBS_PATH, payload)


def create_job(
    job_id: str, schedule_id: str, run_type: str, do_send: bool
) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    record = {
        "job_id": job_id,
        "schedule_id": schedule_id,
        "run_type": run_type,
        "do_send": do_send,
        "status": "queued",  # queued / running / completed / failed
        "phase": "queued",  # syncing / indexing / generating / sending / completed
        "progress": 0.0,
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    with _LOCK:
        payload = _load()
        jobs = payload.setdefault("jobs", {})
        jobs[job_id] = record
        # Cap the store, dropping the oldest jobs.
        if len(jobs) > MAX_JOBS:
            for stale in sorted(jobs, key=lambda k: jobs[k].get("created_at") or "")[
                : len(jobs) - MAX_JOBS
            ]:
                jobs.pop(stale, None)
        _save(payload)
    return record


def set_job(job_id: str, values: dict[str, Any]) -> None:
    with _LOCK:
        payload = _load()
        jobs = payload.setdefault("jobs", {})
        job = jobs.get(job_id, {})
        job.update(values)
        job["updated_at"] = datetime.now(UTC).isoformat()
        jobs[job_id] = job
        _save(payload)


def get_job(job_id: str) -> dict[str, Any] | None:
    with _LOCK:
        return _load().get("jobs", {}).get(job_id)
