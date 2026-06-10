"""AI Schedule — storage for AI report schedules + run history.

Each schedule is a cross-repo report task: it binds to one repo, owns its own
Teams webhook, send time / workdays, report type and custom "整理指令".

Security: the Teams webhook URL is sensitive. The full URL is persisted here but
NEVER returned to the frontend (see ``public_schedule``) and NEVER stored in run
history.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from .config_store import (
    _normalize_send_time,
    _normalize_workdays,
    data_dir,
)
from .utils import read_json, write_json

SCHEDULES_PATH = data_dir() / "ai_report_schedules.json"
HISTORY_PATH = data_dir() / "ai_report_history.json"

MAX_HISTORY = 100
MAX_REPORT_LEN = 20000

REPORT_TYPES = ("daily-briefing", "custom-report")
ISSUE_WINDOWS = ("today", "since-last-run", "last-7-days")
ISSUE_STATES = ("open", "closed", "all")

# Default 整理指令 per report type, brought into the textarea on type change.
LEGACY_DAILY_INSTRUCTION = (
    "請整理今日有更新的 Issue，聚焦今日進展、目前狀態、風險與阻塞、建議下一步，"
    "並附上來源連結。請使用繁體中文。不要重述完整歷史，必要時只補一句背景。"
)
DEFAULT_DAILY_INSTRUCTION = (
    "請整理選定範圍內有變動的 Issue，聚焦本期變動、目前狀態、風險與阻塞、建議下一步，"
    "並附上來源連結。請使用繁體中文。不要重述完整歷史，必要時只補一句背景。"
)
DEFAULT_CUSTOM_INSTRUCTION = (
    "請根據選定時間範圍內的 Issue 更新，產生一份清楚、可行動的專案報告。"
    "請依照重要性整理重點，列出需要追蹤的事項、風險與建議下一步。"
    "請使用繁體中文，並附上來源連結。"
)


def default_instruction(report_type: str) -> str:
    if str(report_type) == "daily-briefing":
        return DEFAULT_DAILY_INSTRUCTION
    return DEFAULT_CUSTOM_INSTRUCTION


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class AiReportSchedule(BaseModel):
    id: str = ""
    enabled: bool = True

    repo_id: str = ""
    repo_name: str = ""
    provider: str = ""  # gitlab / github / import

    name: str = "每日 Issue 摘要"
    report_type: str = "daily-briefing"  # daily-briefing / custom-report
    custom_instruction: str = ""
    preferred_model: str = ""

    send_time: str = "18:30"
    timezone: str = "Asia/Taipei"
    workdays: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])

    channel_type: str = "teams-webhook"
    teams_webhook_url: str = ""

    updated_issue_window: str = "today"
    issue_state: str = "all"  # open / closed / all
    labels: list[str] = Field(default_factory=list)
    assignees: list[str] = Field(default_factory=list)

    include_risks: bool = True
    include_next_steps: bool = True
    include_source_links: bool = True

    # When true, Preview / Send Now / scheduled send first fully rebuild this
    # repo's index (async, with progress) before producing the report.
    rebuild_index_before_send: bool = False

    last_run_at: str | None = None
    last_run_status: str | None = None  # success / failed / skipped
    last_run_error: str | None = None
    next_run_at: str | None = None

    created_at: str = ""
    updated_at: str = ""


class AiReportRunHistory(BaseModel):
    id: str = ""
    schedule_id: str = ""
    repo_id: str = ""
    repo_name: str = ""

    report_type: str = "daily-briefing"
    channel_type: str = "teams-webhook"
    run_type: str = "manual"  # scheduled / manual / test / preview

    issue_count: int = 0
    ok: bool = False
    error_message: str = ""

    # Full LLM report so a history row can be re-opened in the preview modal.
    # ``report_message`` is length-capped on write (see append_history).
    report_title: str = ""
    report_message: str = ""
    report_mode: str = ""
    report_model: str = ""
    report_generated_at: str = ""

    index_built_at: str | None = None
    started_at: str = ""
    finished_at: str = ""


# --------------------------------------------------------------------------- #
# Normalization
# --------------------------------------------------------------------------- #
def _normalize_report_type(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in REPORT_TYPES else "daily-briefing"


def _normalize_window(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in ISSUE_WINDOWS else "today"


def _normalize_state(value: Any) -> str:
    text = str(value or "").strip().lower()
    return text if text in ISSUE_STATES else "all"


def _normalize_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for item in value:
        text = str(item).strip()
        if text and text not in items:
            items.append(text)
    return items


def normalize_schedule(raw: Any) -> dict[str, Any]:
    """Coerce arbitrary input into a valid schedule dict (no id/timestamps logic)."""
    source = raw if isinstance(raw, dict) else {}
    fields = {
        key: source[key]
        for key in source
        if key in AiReportSchedule.model_fields and source[key] is not None
    }
    data = AiReportSchedule(**fields).model_dump()

    data["report_type"] = _normalize_report_type(source.get("report_type"))
    data["send_time"] = _normalize_send_time(source.get("send_time", data["send_time"]))
    data["workdays"] = _normalize_workdays(source.get("workdays"))
    data["timezone"] = (
        str(source.get("timezone") or data["timezone"]).strip() or "Asia/Taipei"
    )
    data["updated_issue_window"] = _normalize_window(source.get("updated_issue_window"))
    data["issue_state"] = _normalize_state(source.get("issue_state"))
    data["labels"] = _normalize_str_list(source.get("labels"))
    data["assignees"] = _normalize_str_list(source.get("assignees"))
    data["channel_type"] = "teams-webhook"
    data["repo_id"] = str(source.get("repo_id") or "").strip()
    data["repo_name"] = str(source.get("repo_name") or "").strip()
    data["provider"] = str(source.get("provider") or "").strip()
    data["name"] = str(source.get("name") or data["name"]).strip() or "每日 Issue 摘要"
    data["custom_instruction"] = str(source.get("custom_instruction") or "")
    if (
        data["report_type"] == "daily-briefing"
        and data["custom_instruction"] == LEGACY_DAILY_INSTRUCTION
    ):
        data["custom_instruction"] = DEFAULT_DAILY_INSTRUCTION
    data["preferred_model"] = str(source.get("preferred_model") or "").strip()
    data["teams_webhook_url"] = str(source.get("teams_webhook_url") or "").strip()
    data["rebuild_index_before_send"] = bool(
        source.get("rebuild_index_before_send", data["rebuild_index_before_send"])
    )
    return data


# --------------------------------------------------------------------------- #
# Storage
# --------------------------------------------------------------------------- #
def load_schedules() -> list[dict[str, Any]]:
    """All schedules WITH their real webhook URLs (backend-internal use only)."""
    data = read_json(SCHEDULES_PATH, [])
    if not isinstance(data, list):
        return []
    return [normalize_schedule(item) | _identity(item) for item in data]


def _identity(item: dict[str, Any]) -> dict[str, Any]:
    """Preserve id + timestamps + last/next-run bookkeeping across normalization."""
    keys = (
        "id",
        "created_at",
        "updated_at",
        "last_run_at",
        "last_run_status",
        "last_run_error",
        "next_run_at",
    )
    return {key: item.get(key) for key in keys if item.get(key) is not None}


def _write_schedules(schedules: list[dict[str, Any]]) -> None:
    write_json(SCHEDULES_PATH, schedules)


def get_schedule(schedule_id: str) -> dict[str, Any] | None:
    for schedule in load_schedules():
        if schedule.get("id") == schedule_id:
            return schedule
    return None


def create_schedule(payload: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    schedule = normalize_schedule(payload)
    schedule["id"] = f"schedule_{uuid.uuid4().hex[:12]}"
    schedule["created_at"] = now
    schedule["updated_at"] = now
    schedule["last_run_at"] = None
    schedule["last_run_status"] = None
    schedule["last_run_error"] = None
    schedule["next_run_at"] = None
    if not schedule["custom_instruction"]:
        schedule["custom_instruction"] = default_instruction(schedule["report_type"])

    schedules = load_schedules()
    schedules.append(schedule)
    _write_schedules(schedules)
    return schedule


def update_schedule(schedule_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    schedules = load_schedules()
    for index, existing in enumerate(schedules):
        if existing.get("id") != schedule_id:
            continue

        merged = normalize_schedule(payload)
        merged["id"] = existing["id"]
        merged["created_at"] = (
            existing.get("created_at") or datetime.now(UTC).isoformat()
        )
        merged["updated_at"] = datetime.now(UTC).isoformat()
        # Run bookkeeping is owned by the runner, not the editor.
        for key in ("last_run_at", "last_run_status", "last_run_error", "next_run_at"):
            merged[key] = existing.get(key)

        # Webhook URL: keep the stored one unless a new value is sent or an
        # explicit clear is requested. The full URL never round-trips through
        # the frontend, so a missing value means "unchanged".
        incoming_url = str((payload or {}).get("teams_webhook_url") or "").strip()
        if (payload or {}).get("clear_teams_webhook_url"):
            merged["teams_webhook_url"] = ""
        elif not incoming_url:
            merged["teams_webhook_url"] = existing.get("teams_webhook_url") or ""
        else:
            merged["teams_webhook_url"] = incoming_url

        schedules[index] = merged
        _write_schedules(schedules)
        return merged
    return None


def delete_schedule(schedule_id: str) -> bool:
    schedules = load_schedules()
    remaining = [s for s in schedules if s.get("id") != schedule_id]
    if len(remaining) == len(schedules):
        return False
    _write_schedules(remaining)
    return True


def update_run_state(
    schedule_id: str,
    *,
    last_run_at: str,
    last_run_status: str,
    last_run_error: str = "",
    next_run_at: str | None = None,
) -> None:
    schedules = load_schedules()
    for schedule in schedules:
        if schedule.get("id") == schedule_id:
            schedule["last_run_at"] = last_run_at
            schedule["last_run_status"] = last_run_status
            schedule["last_run_error"] = last_run_error
            if next_run_at is not None:
                schedule["next_run_at"] = next_run_at
            _write_schedules(schedules)
            return


# --------------------------------------------------------------------------- #
# Public (frontend-safe) view
# --------------------------------------------------------------------------- #
def public_schedule(schedule: dict[str, Any]) -> dict[str, Any]:
    """Strip the real webhook URL; expose a masked preview + a boolean flag."""
    from .daily_briefing_service import mask_webhook_url

    safe = dict(schedule)
    url = str(safe.pop("teams_webhook_url", "") or "")
    safe["has_teams_webhook_url"] = bool(url)
    safe["teams_webhook_url_masked"] = mask_webhook_url(url)
    return safe


def public_schedules() -> list[dict[str, Any]]:
    return [public_schedule(s) for s in load_schedules()]


# --------------------------------------------------------------------------- #
# History
# --------------------------------------------------------------------------- #
def load_history() -> list[dict[str, Any]]:
    data = read_json(HISTORY_PATH, [])
    return data if isinstance(data, list) else []


def append_history(entry: dict[str, Any]) -> dict[str, Any]:
    """Append a run record (newest first). The webhook URL is never persisted."""
    record = AiReportRunHistory(
        **{k: entry.get(k) for k in entry if k in AiReportRunHistory.model_fields}
    ).model_dump()
    if not record.get("id"):
        record["id"] = f"run_{uuid.uuid4().hex[:12]}"
    record.pop("teams_webhook_url", None)

    # Cap the stored report body so a long backlog of history can't bloat the
    # json file unbounded; the modal still shows the full report for recent runs.
    message = record.get("report_message") or ""
    if len(message) > MAX_REPORT_LEN:
        record["report_message"] = (
            message[:MAX_REPORT_LEN] + "\n\n…（內容過長，已截斷）"
        )

    history = load_history()
    history.insert(0, record)
    history = history[:MAX_HISTORY]
    write_json(HISTORY_PATH, history)
    return record


def list_history(
    *,
    schedule_id: str | None = None,
    repo_id: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    items = load_history()
    if schedule_id:
        items = [i for i in items if i.get("schedule_id") == schedule_id]
    if repo_id:
        items = [i for i in items if i.get("repo_id") == repo_id]
    return items[: max(1, min(int(limit or 50), MAX_HISTORY))]
