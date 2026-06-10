from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


def detect_provider_from_url(url: str) -> str:
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower()
    if host in {"github.com", "www.github.com"}:
        return "github"
    return "gitlab"


def parse_issue_source_url(url: str) -> tuple[str, str, str, int]:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid issue URL.")

    provider = detect_provider_from_url(url)
    parts = [part for part in parsed.path.split("/") if part]
    if provider == "github":
        if len(parts) < 4 or parts[2] != "issues":
            raise ValueError("The URL does not point to a GitHub issue.")
        try:
            issue_iid = int(parts[3])
        except ValueError as exc:
            raise ValueError("Unable to resolve GitHub issue number from URL.") from exc
        return provider, "https://github.com", "/".join(parts[:2]), issue_iid

    base_url, project_ref, issue_iid = _parse_gitlab_issue_url(parsed)
    return provider, base_url, project_ref, issue_iid


def parse_issue_url(url: str) -> tuple[str, str, int]:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid GitLab issue URL.")
    return (
        _parse_gitlab_issue_url(parsed)
        if detect_provider_from_url(url) == "gitlab"
        else parse_issue_source_url(url)[1:]
    )


def _parse_gitlab_issue_url(parsed) -> tuple[str, str, int]:
    parts = [part for part in parsed.path.split("/") if part]
    if "- " in parts:
        raise ValueError("Invalid GitLab issue URL.")
    if "-" not in parts:
        raise ValueError("Unable to resolve project path from issue URL.")

    marker_index = parts.index("-")
    if marker_index < 1 or marker_index + 2 >= len(parts):
        raise ValueError("Unable to resolve project path from issue URL.")

    item_kind = parts[marker_index + 1]
    if item_kind not in {"issues", "work_items"}:
        raise ValueError("The URL does not point to a GitLab issue.")

    try:
        issue_iid = int(parts[marker_index + 2])
    except ValueError as exc:
        raise ValueError("Unable to resolve issue IID from URL.") from exc

    base_url = f"{parsed.scheme}://{parsed.netloc}"
    project_ref = "/".join(parts[:marker_index])
    if not project_ref:
        raise ValueError("Unable to resolve project path from issue URL.")

    return base_url, project_ref, issue_iid


def is_filter_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    if detect_provider_from_url(value) == "github":
        parts = [part for part in parsed.path.split("/") if part]
        return len(parts) == 3 and parts[2] == "issues" and bool(parsed.query)
    return "/-/issues?" in value


def parse_filter_source_url(
    filter_url: str,
) -> tuple[str, str, str, dict[str, str], list[str], list[str], list[str]]:
    if detect_provider_from_url(filter_url) == "github":
        parsed = urlparse(filter_url.strip())
        if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() not in {
            "github.com",
            "www.github.com",
        }:
            raise ValueError("Invalid GitHub issue filter URL.")
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) != 3 or parts[2] != "issues":
            raise ValueError("The URL does not look like a GitHub issue filter page.")
        query = parse_qs(parsed.query, keep_blank_values=False)
        qualifiers = " ".join(query.get("q", []))
        state_match = re.search(r"(?:state|is):(open|closed)", qualifiers)
        labels = re.findall(r'label:"([^"]+)"|label:([^\s]+)', qualifiers)
        label_values = [quoted or plain for quoted, plain in labels]
        if query.get("labels"):
            label_values.extend(
                value for raw in query["labels"] for value in raw.split(",") if value
            )
        params: dict[str, str] = {
            "state": (
                state_match.group(1) if state_match else query.get("state", ["open"])[0]
            )
        }
        assignee_match = re.search(r"assignee:([^\s]+)", qualifiers)
        if assignee_match:
            params["assignee"] = assignee_match.group(1)
        if label_values:
            params["labels"] = ",".join(dict.fromkeys(label_values))
        return (
            "github",
            "https://github.com",
            "/".join(parts[:2]),
            params,
            [],
            [],
            [],
        )

    base_url, project_ref, params, labels, or_labels, not_labels = parse_filter_url(
        filter_url
    )
    return "gitlab", base_url, project_ref, params, labels, or_labels, not_labels


def parse_filter_url(
    filter_url: str,
) -> tuple[str, str, dict[str, str], list[str], list[str], list[str]]:
    if detect_provider_from_url(filter_url) == "github":
        parsed = parse_filter_source_url(filter_url)
        return parsed[1], parsed[2], parsed[3], parsed[4], parsed[5], parsed[6]

    parsed = urlparse(filter_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid GitLab filter URL.")

    path = parsed.path or ""
    marker = "/-/issues"
    marker_index = path.find(marker)
    if marker_index <= 0:
        raise ValueError("The URL does not look like a GitLab issue filter page.")

    project_ref = path[:marker_index].strip("/")
    if not project_ref:
        raise ValueError("Unable to resolve project path from filter URL.")

    query = parse_qs(parsed.query, keep_blank_values=False)
    params: dict[str, str] = {"state": query.get("state", ["opened"])[0]}

    if "milestone_title" in query:
        params["milestone"] = query["milestone_title"][0]

    if "assignee_username" in query:
        params["assignee_username"] = query["assignee_username"][0]

    labels = query.get("label_name[]", [])
    or_labels = query.get("or[label_name][]", [])
    not_labels = query.get("not[label_name][]", [])

    base_url = f"{parsed.scheme}://{parsed.netloc}"
    return base_url, project_ref, params, labels, or_labels, not_labels


def format_issue_preview(issue: dict) -> dict:
    assignees = [
        item.get("name") for item in issue.get("assignees", []) if item.get("name")
    ]
    milestone = issue.get("milestone") or {}
    return {
        "iid": issue.get("iid"),
        "title": issue.get("title") or "",
        "web_url": issue.get("web_url") or "",
        "state": issue.get("state") or "",
        "assignees": assignees,
        "milestone": (
            {
                "title": milestone.get("title") or "",
                "due_date": milestone.get("due_date") or "",
            }
            if milestone.get("title")
            else None
        ),
        "labels": issue.get("labels") or [],
    }


def _fmt_dt(raw: str | None) -> str:
    """Convert ISO datetime string to 'YYYY-MM-DD HH:MM', return '' if invalid."""
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:  # noqa: BLE001
        return raw[:16].replace("T", " ")


def build_issue_raw_text(issue: dict, discussions: Iterable[dict]) -> str:
    milestone = issue.get("milestone") or {}
    author = issue.get("author") or {}
    assignees = [
        item.get("name") for item in issue.get("assignees", []) if item.get("name")
    ]

    lines = [f"# #{issue.get('iid')} {issue.get('title') or 'Untitled'}", ""]

    # ── 基本資訊 ──────────────────────────────────────────
    meta_lines = []
    if issue.get("state"):
        meta_lines.append(f"- **狀態**：{issue['state']}")
    if author.get("name"):
        created_dt = _fmt_dt(issue.get("created_at"))
        author_label = author["name"]
        if created_dt:
            author_label += f"（{created_dt}）"
        meta_lines.append(f"- **建立者**：{author_label}")
    if assignees:
        meta_lines.append(f"- **指派對象**：{', '.join(assignees)}")
    if issue.get("labels"):
        meta_lines.append(f"- **標籤**：{', '.join(issue['labels'])}")
    if milestone.get("title"):
        ms_label = milestone["title"]
        if milestone.get("due_date"):
            ms_label += f"（截止 {milestone['due_date']}）"
        meta_lines.append(f"- **Milestone**：{ms_label}")
    if issue.get("due_date"):
        meta_lines.append(f"- **到期日**：{issue['due_date']}")
    if issue.get("updated_at"):
        meta_lines.append(f"- **最後更新**：{_fmt_dt(issue['updated_at'])}")
    if issue.get("closed_at"):
        meta_lines.append(f"- **關閉時間**：{_fmt_dt(issue['closed_at'])}")

    if meta_lines:
        lines.extend(["## 基本資訊", *meta_lines, ""])

    # ── 留言 ─────────────────────────────────────────────
    note_blocks: list[tuple[str, str, str]] = []  # (author, datetime, body)
    for discussion in discussions:
        for note in discussion.get("notes", []):
            body = (note.get("body") or "").strip()
            if not body:
                continue
            note_author = note.get("author_name") or "Unknown"
            note_dt = _fmt_dt(note.get("created_at"))
            note_blocks.append((note_author, note_dt, body))

    if note_blocks:
        lines.append(f"## 留言（共 {len(note_blocks)} 則）")
        lines.append("")
        for idx, (note_author, note_dt, body) in enumerate(note_blocks, start=1):
            header = f"### 留言 {idx}｜{note_author}"
            if note_dt:
                header += f"（{note_dt}）"
            lines.append(header)
            lines.append(body)
            lines.append("")
    else:
        lines.extend(["## 留言", "（無留言）", ""])

    return "\n".join(lines).strip()


def format_duration(seconds: int | None) -> str:
    if not seconds:
        return ""
    hours, remainder = divmod(int(seconds), 3600)
    minutes = remainder // 60
    if hours:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


PRIORITY_MAP = {
    "Priority::High": "High",
    "Priority::Medium": "Medium",
    "Priority::Low": "Low",
}

TEAM_MAPPING = {
    "Team::UI/UX Design": "UI/UX",
    "Team::Frontend": "FE",
    "Team::Backend": "BE",
    "Team::Infra": "Infra",
    "Team::AI/SAM worker": "AI worker",
    "Team::AI": "AI",
    "Team::IT": "IE",
}

IGNORED_LABELS = {"Enhancement", "UI Done", "UX Done"}
TAG_KEYWORDS = ["PES", "Suggestion", "Bug"]


def build_excel_row(issue: dict) -> dict:
    labels = issue.get("labels") or []
    assignees = [
        item.get("name") for item in issue.get("assignees", []) if item.get("name")
    ]
    milestone = issue.get("milestone") or {}
    author = issue.get("author") or {}
    parsed_labels = parse_labels(labels)

    return {
        "Issue ID": issue.get("iid") or "",
        "Title": issue.get("title") or "",
        "State": issue.get("state") or "",
        "Priority": parsed_labels["priority"],
        "Tag": parsed_labels["tags"],
        "Epics": parsed_labels["epics"],
        "Other Labels": parsed_labels["other_labels"],
        "UI/UX": parsed_labels.get("UI/UX", ""),
        "FE": parsed_labels.get("FE", ""),
        "BE": parsed_labels.get("BE", ""),
        "Infra": parsed_labels.get("Infra", ""),
        "AI worker": parsed_labels.get("AI worker", ""),
        "AI": parsed_labels.get("AI", ""),
        "IE": parsed_labels.get("IE", ""),
        "Assignees": ", ".join(assignees),
        "Author": author.get("name") or "",
        "Created At": format_excel_datetime(issue.get("created_at")),
        "Updated At": format_excel_datetime(issue.get("updated_at")),
        "Due Date": issue.get("due_date") or "",
        "Milestone": milestone.get("title") or "",
        "Weight": "" if issue.get("weight") is None else issue.get("weight") or "",
        "Time Estimate": format_duration(
            (issue.get("time_stats") or {}).get("time_estimate")
        ),
        "Time Spent": format_duration(
            (issue.get("time_stats") or {}).get("total_time_spent")
        ),
        "URL": issue.get("web_url") or "",
    }


def parse_labels(labels: list[str]) -> dict[str, str]:
    label_set = set(labels)
    priority = next(
        (short for label, short in PRIORITY_MAP.items() if label in label_set), ""
    )
    tag_matches = [
        tag
        for tag in TAG_KEYWORDS
        if any(tag.lower() == value.lower() for value in labels)
    ]
    epics = [
        label.replace("Epics:", "").strip()
        for label in labels
        if label.startswith("Epics:")
    ]

    team_status = dict.fromkeys(TEAM_MAPPING.values(), "")
    for label, column in TEAM_MAPPING.items():
        if label in label_set:
            team_status[column] = (
                "Done"
                if column == "UI/UX" and {"UI Done", "UX Done"} <= label_set
                else "0%"
            )

    known_labels = set(PRIORITY_MAP) | set(TEAM_MAPPING) | IGNORED_LABELS
    lower_tags = {tag.lower() for tag in TAG_KEYWORDS}
    other_labels = [
        label
        for label in labels
        if label not in known_labels
        and not label.startswith("Epics:")
        and label.lower() not in lower_tags
    ]

    return {
        "priority": priority,
        "tags": ", ".join(tag_matches),
        "epics": ", ".join(epics),
        "other_labels": ", ".join(other_labels),
        **team_status,
    }


def format_excel_datetime(value: str | None) -> str:
    if not value:
        return ""
    try:
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        return datetime.fromisoformat(normalized).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return value


ARCHIVE_KIND_DIRS = {
    "scrape": "scrape",
    "result": "result",
    "excel": "excel",
}
ARCHIVE_FILENAME_RE = re.compile(r"^[\w.\-]+\.(md|txt|xlsx)$")


def _sanitize_archive_part(value: str) -> str:
    text = (value or "").strip().replace("/", "-").replace("\\", "-")
    text = re.sub(r"[^\w\-.]+", "-", text, flags=re.UNICODE)
    text = re.sub(r"-{2,}", "-", text).strip("-._")
    return text or "unknown"


def _archive_repo_name(project_ref: str) -> str:
    parts = [part for part in project_ref.split("/") if part]
    if not parts:
        return "unknown-repo"
    if parts[-1] == "gitlab-profile" and len(parts) >= 2:
        return parts[-2]
    return parts[-1]


def build_arrange_archive_filename(
    url: str,
    kind: str,
    model_name: str | None = None,
    extension: str = "md",
    now: datetime | None = None,
) -> str:
    _base_url, project_ref, issue_iid = parse_issue_url(url)
    repo_name = _sanitize_archive_part(_archive_repo_name(project_ref))
    item_number = _sanitize_archive_part(str(issue_iid))
    timestamp = (now or datetime.now()).strftime("%Y%m%d_%H%M%S")
    suffix = (
        "scrape"
        if kind == "scrape"
        else _sanitize_archive_part(model_name or "unknown-model")
    )
    return f"{repo_name}_{item_number}_{suffix}_{timestamp}.{extension}"


def save_arrange_output(
    base_dir: Path,
    content: str,
    kind: str,
    url: str,
    model_name: str | None = None,
    extension: str = "md",
) -> Path:
    folder_name = ARCHIVE_KIND_DIRS.get(kind)
    if not folder_name:
        raise ValueError(f"Unsupported arrange archive kind: {kind}")

    directory = base_dir / folder_name
    directory.mkdir(parents=True, exist_ok=True)

    filepath = directory / build_arrange_archive_filename(
        url=url,
        kind=kind,
        model_name=model_name,
        extension=extension,
    )
    if filepath.exists():
        stem = filepath.stem
        suffix = filepath.suffix
        counter = 2
        while filepath.exists():
            filepath = directory / f"{stem}_{counter}{suffix}"
            counter += 1

    filepath.write_text(content, encoding="utf-8")
    return filepath


def list_arrange_outputs(base_dir: Path) -> list[dict[str, Any]]:
    base_dir.mkdir(parents=True, exist_ok=True)

    entries: list[tuple[str, Path]] = []
    for kind, folder_name in ARCHIVE_KIND_DIRS.items():
        directory = base_dir / folder_name
        if not directory.exists():
            continue
        patterns = ("*.xlsx",) if kind == "excel" else ("*.md", "*.txt")
        for pattern in patterns:
            entries.extend((kind, path) for path in directory.glob(pattern))

    # Backward compatibility for earlier Excel exports written in the root folder.
    entries.extend(("excel", path) for path in base_dir.glob("*.xlsx"))
    entries.sort(key=lambda item: item[1].stat().st_mtime, reverse=True)

    return [
        {
            "filename": path.name,
            "kind": kind,
            "size": path.stat().st_size,
            "mtime": datetime.fromtimestamp(path.stat().st_mtime).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "path": str(path),
        }
        for kind, path in entries
    ]


def resolve_arrange_output(base_dir: Path, filename: str) -> tuple[Path, str]:
    if not ARCHIVE_FILENAME_RE.match(filename):
        raise ValueError("Invalid arrange archive filename.")

    candidates = [
        (base_dir / folder_name / filename, kind)
        for kind, folder_name in ARCHIVE_KIND_DIRS.items()
    ]
    candidates.append((base_dir / filename, "excel"))

    for path, kind in candidates:
        if path.exists() and path.is_file():
            return path, kind

    raise FileNotFoundError(filename)
