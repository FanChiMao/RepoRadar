from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .config_store import REPORT_DIR
from .utils import parse_dt


def extract_module(issue: dict[str, Any]) -> str | None:
    labels = issue.get("labels") or []
    for label in labels:
        if label.startswith("【Page】"):
            return label.replace("【Page】", "").strip()
    title = issue.get("title") or ""
    if title.startswith("[") and "]" in title:
        return title[1 : title.index("]")].strip()
    return None


def simplify_issue(
    issue: dict[str, Any], note: str | None = None, reason: str | None = None
) -> dict[str, Any]:
    task_status = issue.get("task_completion_status") or {}
    return {
        "iid": issue.get("iid"),
        "provider": issue.get("provider") or "gitlab",
        "source_ref": issue.get("source_ref"),
        "schema_version": issue.get("schema_version", 1),
        "relation_counts_known": issue.get("relation_counts_known", True),
        "title": issue.get("title"),
        "state": issue.get("state"),
        "module": extract_module(issue),
        "labels": issue.get("labels", []),
        "assignees": [
            item.get("name") for item in issue.get("assignees", []) if item.get("name")
        ],
        "assignee_details": [
            {
                "name": item.get("name"),
                "username": item.get("username"),
                "avatar_url": item.get("avatar_url"),
            }
            for item in issue.get("assignees", [])
            if item.get("name")
        ],
        "milestone": (issue.get("milestone") or {}).get("title"),
        "milestone_start_date": (issue.get("milestone") or {}).get("start_date"),
        "milestone_due_date": (issue.get("milestone") or {}).get("due_date"),
        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "closed_at": issue.get("closed_at"),
        "due_date": issue.get("due_date")
        or (issue.get("milestone") or {}).get("due_date"),
        "web_url": issue.get("web_url"),
        "issue_type": issue.get("issue_type"),
        "merge_requests_count": issue.get("merge_requests_count", 0),
        "blocking_issues_count": issue.get("blocking_issues_count", 0),
        "task_total": task_status.get("count", 0),
        "task_completed": task_status.get("completed_count", 0),
        "user_notes_count": issue.get("user_notes_count", 0),
        "has_new_discussions": issue.get("has_new_discussions", False),
        "note": note,
        "reason": reason,
    }


def _recent(issue: dict[str, Any], field: str, since: datetime) -> bool:
    dt = parse_dt(issue.get(field))
    return bool(dt and dt >= since)


def build_dashboard(
    issues: list[dict[str, Any]], now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    since = now - timedelta(days=7)

    weekly_new = [issue for issue in issues if _recent(issue, "created_at", since)]
    weekly_updated = [issue for issue in issues if _recent(issue, "updated_at", since)]
    weekly_closed = [
        issue
        for issue in issues
        if issue.get("state") == "closed" and _recent(issue, "closed_at", since)
    ]
    open_issues = [issue for issue in issues if issue.get("state") != "closed"]
    unassigned = [issue for issue in open_issues if not issue.get("assignees")]

    focus_candidates = sorted(
        weekly_updated,
        key=lambda item: (
            0 if item.get("description") else 1,
            0 if item.get("issue_type") == "issue" else 1,
            -(len(item.get("labels") or [])),
        ),
    )

    focus_progress = [
        simplify_issue(
            issue,
            note="近 7 天內有更新，且具備較完整上下文或屬於 bug/issue 類型。",
        )
        for issue in focus_candidates[:8]
    ]

    risks: list[dict[str, Any]] = []
    for issue in open_issues:
        due_date_raw = issue.get("due_date") or (issue.get("milestone") or {}).get(
            "due_date"
        )
        due_date = parse_dt(f"{due_date_raw}T00:00:00+00:00") if due_date_raw else None
        updated_at = parse_dt(issue.get("updated_at"))

        reasons: list[str] = []
        if not issue.get("assignees"):
            reasons.append("尚未指派負責人")
        if due_date and due_date <= now + timedelta(days=7):
            reasons.append("7 天內到期")
        if updated_at and updated_at < now - timedelta(days=14):
            reasons.append("超過 14 天未更新")

        if reasons:
            risks.append(simplify_issue(issue, reason="；".join(reasons)))

    risks = sorted(
        risks,
        key=lambda item: (
            0 if "尚未指派負責人" in (item.get("reason") or "") else 1,
            item.get("due_date") or "9999-12-31",
        ),
    )[:10]
    by_module = Counter(filter(None, (extract_module(issue) for issue in open_issues)))

    return {
        "summary": {
            "weekly_new_count": len(weekly_new),
            "weekly_updated_count": len(weekly_updated),
            "weekly_closed_count": len(weekly_closed),
            "open_issue_count": len(open_issues),
            "unassigned_count": len(unassigned),
            "risk_count": len(risks),
            "near_due_count": sum(
                1 for item in risks if "7 天內到期" in (item.get("reason") or "")
            ),
            "top_modules": by_module.most_common(5),
        },
        "weekly_new": [
            simplify_issue(issue)
            for issue in sorted(
                weekly_new, key=lambda item: item.get("created_at") or "", reverse=True
            )
        ],
        "focus_progress": focus_progress,
        "risks": risks,
    }


def generate_weekly_markdown(
    dashboard: dict[str, Any], target_path: Path, generated_at: datetime | None = None
) -> Path:
    generated_at = generated_at or datetime.now(UTC)
    summary = dashboard["summary"]

    lines = [
        "# Gitlab Tracker 週報",
        "",
        f'- 產生時間：{generated_at.astimezone().strftime("%Y-%m-%d %H:%M:%S")}',
        f'- 本週新增：{summary["weekly_new_count"]}',
        f'- 本週更新：{summary["weekly_updated_count"]}',
        f'- 目前開啟中：{summary["open_issue_count"]}',
        f'- 風險項目：{summary["risk_count"]}',
        "",
        "## 1. 週摘要",
        "",
        "| 指標 | 數量 |",
        "|---|---:|",
        f'| 本週新增 | {summary["weekly_new_count"]} |',
        f'| 本週更新 | {summary["weekly_updated_count"]} |',
        f'| 本週關閉 | {summary["weekly_closed_count"]} |',
        f'| 目前開啟中 | {summary["open_issue_count"]} |',
        f'| 無負責人 | {summary["unassigned_count"]} |',
        f'| 風險項目 | {summary["risk_count"]} |',
        "",
        "## 2. 本週新增 Issue",
        "",
        "| IID | 模組 | 標題 | Assignee | Milestone | 狀態 |",
        "|---|---|---|---|---|---|",
    ]
    for item in dashboard["weekly_new"][:20]:
        lines.append(
            f"| #{item['iid']} | {item['module'] or '-'} | {item['title']} | {', '.join(item['assignees']) or '-'} | {item['milestone'] or '-'} | {item['state']} |"
        )

    lines.extend(["", "## 3. 本週重點推進", ""])
    for item in dashboard["focus_progress"]:
        lines.extend(
            [
                f"- **#{item['iid']} {item['title']}**",
                f"  - 模組：{item['module'] or '-'} / Assignee：{', '.join(item['assignees']) or '-'} / Milestone：{item['milestone'] or '-'}",
                f"  - 說明：{item.get('note') or '-'}",
            ]
        )

    lines.extend(["", "## 4. 風險與阻塞", ""])
    for item in dashboard["risks"]:
        lines.extend(
            [
                f"- **#{item['iid']} {item['title']}**",
                f"  - 原因：{item.get('reason') or '-'}",
                f"  - 模組：{item['module'] or '-'} / Assignee：{', '.join(item['assignees']) or '-'} / Milestone：{item['milestone'] or '-'}",
            ]
        )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text("\n".join(lines), encoding="utf-8")
    return target_path


def weekly_report_path(now: datetime | None = None) -> Path:
    now = now or datetime.now(UTC)
    file_name = f"weekly_report_{now.strftime('%Y%m%d_%H%M%S')}.md"
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    return REPORT_DIR / file_name
