from __future__ import annotations

import hashlib
import json
import re
import threading
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from .config_store import data_dir, load_config
from .provider import IssueProvider, active_provider_context
from .report_service import simplify_issue
from .utils import parse_dt, read_json, write_json

RAG_INDEX_PATH = data_dir() / "rag_index.json"
RAG_JOB_STATE_PATH = data_dir() / "rag_rebuild_jobs.json"

STOPWORDS = {
    "the",
    "a",
    "an",
    "to",
    "for",
    "of",
    "and",
    "or",
    "is",
    "are",
    "in",
    "on",
    "by",
    "with",
    "from",
    "at",
    "be",
    "as",
    "it",
    "this",
    "that",
    "what",
    "which",
    "how",
    "who",
    "why",
    "when",
    "issue",
    "gitlab",
    "github",
    "comment",
    "discussion",
    "please",
    "help",
    "的",
    "了",
    "是",
    "在",
    "有",
    "和",
    "與",
    "及",
    "要",
    "請",
    "幫",
    "一下",
    "目前",
    "最近",
    "哪些",
    "什麼",
    "如何",
    "還有",
    "這個",
    "那個",
    "是不是",
    "可以",
    "比較",
    "關於",
    "問題",
}

_JOB_LOCK = threading.Lock()
_ACTIVE_THREADS: dict[str, threading.Thread] = {}


def _normalize_text(text: str) -> str:
    value = (text or "").replace("\r", "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _tokenize(text: str) -> list[str]:
    items = re.findall(r"[A-Za-z0-9_#./:-]+|[\u4e00-\u9fff]{2,}", (text or "").lower())
    return [item for item in items if item not in STOPWORDS and len(item.strip()) > 1]


def _load_jobs() -> dict[str, Any]:
    return read_json(RAG_JOB_STATE_PATH, {"jobs": {}})


def _save_jobs(payload: dict[str, Any]) -> None:
    write_json(RAG_JOB_STATE_PATH, payload)


def _set_job(job_id: str, values: dict[str, Any]) -> None:
    with _JOB_LOCK:
        payload = _load_jobs()
        jobs = payload.setdefault("jobs", {})
        job = jobs.get(job_id, {})
        job.update(values)
        jobs[job_id] = job
        _save_jobs(payload)


def list_rag_jobs() -> dict[str, Any]:
    payload = _load_jobs()
    jobs = payload.get("jobs", {})
    sorted_jobs = sorted(
        jobs.values(),
        key=lambda item: item.get("updated_at") or item.get("created_at") or "",
        reverse=True,
    )
    return {"jobs": sorted_jobs[:20]}


def get_rag_job(job_id: str) -> dict[str, Any] | None:
    payload = _load_jobs()
    return payload.get("jobs", {}).get(job_id)


def _issue_summary(issue: dict[str, Any]) -> dict[str, Any]:
    item = simplify_issue(issue)
    return {
        "iid": item["iid"],
        "title": item.get("title", ""),
        "state": item.get("state", "opened"),
        "labels": item.get("labels", []),
        "assignees": item.get("assignees", []),
        "module": item.get("module"),
        "milestone": item.get("milestone"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
        "due_date": item.get("due_date"),
        "web_url": item.get("web_url"),
        "description": issue.get("description", "") or "",
    }


def _issue_cache_signature(raw_issue: dict[str, Any], issue: dict[str, Any]) -> str:
    payload = {
        "iid": issue["iid"],
        "title": issue.get("title", ""),
        "state": issue.get("state", ""),
        "labels": issue.get("labels", []),
        "assignees": issue.get("assignees", []),
        "module": issue.get("module"),
        "milestone": issue.get("milestone"),
        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "due_date": issue.get("due_date"),
        "description": issue.get("description", ""),
        "user_notes_count": raw_issue.get("user_notes_count", 0),
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(serialized.encode("utf-8")).hexdigest()


def _build_overview_chunk(issue: dict[str, Any]) -> dict[str, Any]:
    assignees = ", ".join(issue.get("assignees") or []) or "未指派"
    labels = ", ".join(issue.get("labels") or []) or "無"
    description = _normalize_text(issue.get("description", ""))[:1800]

    text = (
        f"Issue #{issue['iid']}\n"
        f"Title: {issue.get('title', '')}\n"
        f"State: {issue.get('state', '')}\n"
        f"Assignees: {assignees}\n"
        f"Labels: {labels}\n"
        f"Module: {issue.get('module') or 'N/A'}\n"
        f"Milestone: {issue.get('milestone') or 'N/A'}\n"
        f"Updated: {(issue.get('updated_at') or '')[:19]}\n\n"
        f"Description:\n{description}"
    ).strip()

    tokens = _tokenize(text)
    return {
        "chunk_id": f"issue-{issue['iid']}-overview",
        "issue_iid": issue["iid"],
        "title": issue.get("title", ""),
        "text": text,
        "source_type": "overview",
        "metadata": {
            "state": issue.get("state"),
            "labels": issue.get("labels", []),
            "assignees": issue.get("assignees", []),
            "authors": [],
            "updated_at": issue.get("updated_at"),
            "discussion_id": None,
            "note_ids": [],
        },
        "tokens": tokens,
        "token_freq": dict(Counter(tokens)),
    }


def _note_to_line(note: dict[str, Any]) -> str:
    body = _normalize_text(note.get("body", ""))
    if not body:
        return ""

    author = note.get("author_name") or note.get("author_username") or "匿名"
    created = (note.get("created_at") or "")[:19]
    note_id = note.get("id")
    return f"[{created}] {author} (note:{note_id}): {body}"


def _build_discussion_chunks(
    issue: dict[str, Any],
    discussions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    labels = issue.get("labels", [])
    assignees = issue.get("assignees", [])

    for discussion in discussions:
        discussion_id = discussion.get("id")
        notes = [note for note in discussion.get("notes", []) if not note.get("system")]
        lines = [line for line in (_note_to_line(note) for note in notes) if line]
        if not lines:
            continue

        authors = sorted(
            {
                note.get("author_name") or note.get("author_username") or "匿名"
                for note in notes
                if not note.get("system")
            }
        )

        buffer: list[str] = []
        buffer_note_ids: list[int] = []
        part = 1

        for note, line in zip(notes, lines, strict=False):
            buffer.append(line)
            note_id = note.get("id")
            if isinstance(note_id, int):
                buffer_note_ids.append(note_id)

            joined = "\n".join(buffer)
            if len(joined) >= 1200:
                text = (
                    f"Issue #{issue['iid']} - {issue.get('title', '')}\n"
                    f"State: {issue.get('state', '')}\n"
                    f"Labels: {', '.join(labels) or '無'}\n"
                    f"Assignees: {', '.join(assignees) or '未指派'}\n"
                    f"Discussion:\n{joined}"
                )

                tokens = _tokenize(text)
                chunks.append(
                    {
                        "chunk_id": f"issue-{issue['iid']}-discussion-{discussion_id}-{part}",
                        "issue_iid": issue["iid"],
                        "title": issue.get("title", ""),
                        "text": text,
                        "source_type": "discussion",
                        "metadata": {
                            "state": issue.get("state"),
                            "labels": labels,
                            "assignees": assignees,
                            "authors": authors,
                            "updated_at": issue.get("updated_at"),
                            "discussion_id": discussion_id,
                            "note_ids": buffer_note_ids[:],
                        },
                        "tokens": tokens,
                        "token_freq": dict(Counter(tokens)),
                    }
                )
                buffer = []
                buffer_note_ids = []
                part += 1

        if buffer:
            joined = "\n".join(buffer)
            text = (
                f"Issue #{issue['iid']} - {issue.get('title', '')}\n"
                f"State: {issue.get('state', '')}\n"
                f"Labels: {', '.join(labels) or '無'}\n"
                f"Assignees: {', '.join(assignees) or '未指派'}\n"
                f"Discussion:\n{joined}"
            )

            tokens = _tokenize(text)
            chunks.append(
                {
                    "chunk_id": f"issue-{issue['iid']}-discussion-{discussion_id}-{part}",
                    "issue_iid": issue["iid"],
                    "title": issue.get("title", ""),
                    "text": text,
                    "source_type": "discussion",
                    "metadata": {
                        "state": issue.get("state"),
                        "labels": labels,
                        "assignees": assignees,
                        "authors": authors,
                        "updated_at": issue.get("updated_at"),
                        "discussion_id": discussion_id,
                        "note_ids": buffer_note_ids[:],
                    },
                    "tokens": tokens,
                    "token_freq": dict(Counter(tokens)),
                }
            )

    return chunks


def load_rag_index() -> dict[str, Any]:
    return read_json(
        RAG_INDEX_PATH,
        {
            "built_at": None,
            "issues": 0,
            "indexed_issues": 0,
            "skipped_issues": 0,
            "reused_issues": 0,
            "rebuilt_issues": 0,
            "issue_manifest": {},
            "chunks": [],
        },
    )


def get_rag_status() -> dict[str, Any]:
    index = load_rag_index()
    return {
        "built_at": index.get("built_at"),
        "issue_count": index.get("issues", 0),
        "indexed_issues": index.get("indexed_issues", 0),
        "skipped_issues": index.get("skipped_issues", 0),
        "reused_issues": index.get("reused_issues", 0),
        "rebuilt_issues": index.get("rebuilt_issues", 0),
        "chunk_count": len(index.get("chunks", [])),
    }


def _group_chunks_by_issue(
    chunks: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for chunk in chunks:
        iid = chunk.get("issue_iid")
        if not isinstance(iid, int):
            continue
        grouped.setdefault(iid, []).append(chunk)

    for iid, items in grouped.items():
        grouped[iid] = sorted(items, key=lambda item: str(item.get("chunk_id", "")))

    return grouped


def _existing_issue_cache(index: dict[str, Any]) -> dict[int, dict[str, Any]]:
    manifest = index.get("issue_manifest", {})
    grouped_chunks = _group_chunks_by_issue(index.get("chunks", []))
    cached: dict[int, dict[str, Any]] = {}

    for iid, chunks in grouped_chunks.items():
        manifest_item = manifest.get(str(iid), {})
        cached[iid] = {
            "chunks": chunks,
            "signature": manifest_item.get("signature"),
            "updated_at": manifest_item.get("updated_at")
            or chunks[0].get("metadata", {}).get("updated_at"),
            "indexed": bool(manifest_item.get("indexed", True)),
        }

    return cached


def _rebuild_rag_index_legacy(
    issue_rows: list[dict[str, Any]],
    *,
    job_id: str | None = None,
) -> dict[str, Any]:
    config = load_config()
    client, project_ref = active_provider_context(config)
    existing_index = load_rag_index()
    cached_issues = _existing_issue_cache(existing_index)

    chunks: list[dict[str, Any]] = []
    indexed_issues = 0
    skipped_issues = 0
    reused_issues = 0
    rebuilt_issues = 0
    total = len(issue_rows)
    issue_manifest: dict[str, Any] = {}

    for index, raw in enumerate(issue_rows, start=1):
        issue = _issue_summary(raw)
        signature = _issue_cache_signature(raw, issue)
        cached_issue = cached_issues.get(issue["iid"])
        cached_updated_at = (
            str(cached_issue.get("updated_at") or "") if cached_issue else ""
        )

        if (
            cached_issue
            and cached_issue.get("chunks")
            and (
                cached_issue.get("signature") == signature
                or (
                    cached_updated_at
                    and cached_updated_at == str(issue.get("updated_at") or "")
                )
            )
        ):
            issue_chunks = cached_issue["chunks"]
            chunks.extend(issue_chunks)
            indexed_issues += 1 if cached_issue.get("indexed", True) else 0
            reused_issues += 1
            issue_manifest[str(issue["iid"])] = {
                "signature": signature,
                "updated_at": issue.get("updated_at"),
                "chunk_count": len(issue_chunks),
                "indexed": bool(cached_issue.get("indexed", True)),
                "source": "cache",
            }
        else:
            issue_chunks = [_build_overview_chunk(issue)]

            try:
                discussions = client.fetch_issue_discussions(project_ref, issue["iid"])
                issue_chunks.extend(_build_discussion_chunks(issue, discussions))
                indexed_issues += 1
                rebuilt_issues += 1
                issue_manifest[str(issue["iid"])] = {
                    "signature": signature,
                    "updated_at": issue.get("updated_at"),
                    "chunk_count": len(issue_chunks),
                    "indexed": True,
                    "source": "rebuilt",
                }
            except Exception:
                skipped_issues += 1
                issue_manifest[str(issue["iid"])] = {
                    "signature": signature,
                    "updated_at": issue.get("updated_at"),
                    "chunk_count": len(issue_chunks),
                    "indexed": False,
                    "source": "rebuilt",
                }

            chunks.extend(issue_chunks)

        if job_id:
            progress = round(index / max(total, 1) * 100, 1)
            _set_job(
                job_id,
                {
                    "status": "running",
                    "progress": progress,
                    "current_issue_iid": issue["iid"],
                    "indexed_issues": indexed_issues,
                    "skipped_issues": skipped_issues,
                    "reused_issues": reused_issues,
                    "rebuilt_issues": rebuilt_issues,
                    "chunk_count": len(chunks),
                    "updated_at": datetime.now(UTC).isoformat(),
                },
            )

    payload = {
        "built_at": datetime.now(UTC).isoformat(),
        "issues": len(issue_rows),
        "indexed_issues": indexed_issues,
        "skipped_issues": skipped_issues,
        "reused_issues": reused_issues,
        "rebuilt_issues": rebuilt_issues,
        "issue_manifest": issue_manifest,
        "chunks": chunks,
    }
    write_json(RAG_INDEX_PATH, payload)

    result = {
        "built_at": payload["built_at"],
        "issue_count": len(issue_rows),
        "indexed_issues": indexed_issues,
        "skipped_issues": skipped_issues,
        "reused_issues": reused_issues,
        "rebuilt_issues": rebuilt_issues,
        "chunk_count": len(chunks),
    }

    if job_id:
        _set_job(
            job_id,
            {
                "status": "completed",
                "progress": 100.0,
                "result": result,
                "updated_at": datetime.now(UTC).isoformat(),
            },
        )

    return result


def rebuild_rag_index(
    issue_rows: list[dict[str, Any]],
    *,
    job_id: str | None = None,
) -> dict[str, Any]:
    config = load_config()
    client: IssueProvider | None = None
    project_ref = ""

    def get_client() -> IssueProvider:
        nonlocal client, project_ref
        if client is not None:
            return client
        client, project_ref = active_provider_context(config)
        return client

    existing_index = load_rag_index()
    cached_issues = _existing_issue_cache(existing_index)

    chunks: list[dict[str, Any]] = []
    indexed_issues = 0
    skipped_issues = 0
    reused_issues = 0
    rebuilt_issues = 0
    total = len(issue_rows)
    issue_manifest: dict[str, Any] = {}

    for index, raw in enumerate(issue_rows, start=1):
        issue = _issue_summary(raw)
        signature = _issue_cache_signature(raw, issue)
        cached_issue = cached_issues.get(issue["iid"])
        cached_updated_at = (
            str(cached_issue.get("updated_at") or "") if cached_issue else ""
        )

        if (
            cached_issue
            and cached_issue.get("chunks")
            and (
                cached_issue.get("signature") == signature
                or (
                    cached_updated_at
                    and cached_updated_at == str(issue.get("updated_at") or "")
                )
            )
        ):
            issue_chunks = cached_issue["chunks"]
            chunks.extend(issue_chunks)
            indexed_issues += 1 if cached_issue.get("indexed", True) else 0
            reused_issues += 1
            issue_manifest[str(issue["iid"])] = {
                "signature": signature,
                "updated_at": issue.get("updated_at"),
                "chunk_count": len(issue_chunks),
                "indexed": bool(cached_issue.get("indexed", True)),
                "source": "cache",
            }
        else:
            issue_chunks = [_build_overview_chunk(issue)]

            try:
                provider = get_client()
                discussions = provider.fetch_issue_discussions(
                    project_ref, issue["iid"]
                )
                issue_chunks.extend(_build_discussion_chunks(issue, discussions))
                indexed_issues += 1
                rebuilt_issues += 1
                issue_manifest[str(issue["iid"])] = {
                    "signature": signature,
                    "updated_at": issue.get("updated_at"),
                    "chunk_count": len(issue_chunks),
                    "indexed": True,
                    "source": "rebuilt",
                }
            except Exception:
                skipped_issues += 1
                issue_manifest[str(issue["iid"])] = {
                    "signature": signature,
                    "updated_at": issue.get("updated_at"),
                    "chunk_count": len(issue_chunks),
                    "indexed": False,
                    "source": "rebuilt",
                }

            chunks.extend(issue_chunks)

        if job_id:
            progress = round(index / max(total, 1) * 100, 1)
            _set_job(
                job_id,
                {
                    "status": "running",
                    "progress": progress,
                    "current_issue_iid": issue["iid"],
                    "indexed_issues": indexed_issues,
                    "skipped_issues": skipped_issues,
                    "reused_issues": reused_issues,
                    "rebuilt_issues": rebuilt_issues,
                    "chunk_count": len(chunks),
                    "updated_at": datetime.now(UTC).isoformat(),
                },
            )

    payload = {
        "built_at": datetime.now(UTC).isoformat(),
        "issues": len(issue_rows),
        "indexed_issues": indexed_issues,
        "skipped_issues": skipped_issues,
        "reused_issues": reused_issues,
        "rebuilt_issues": rebuilt_issues,
        "issue_manifest": issue_manifest,
        "chunks": chunks,
    }
    write_json(RAG_INDEX_PATH, payload)

    result = {
        "built_at": payload["built_at"],
        "issue_count": len(issue_rows),
        "indexed_issues": indexed_issues,
        "skipped_issues": skipped_issues,
        "reused_issues": reused_issues,
        "rebuilt_issues": rebuilt_issues,
        "chunk_count": len(chunks),
    }

    if job_id:
        _set_job(
            job_id,
            {
                "status": "completed",
                "progress": 100.0,
                "result": result,
                "updated_at": datetime.now(UTC).isoformat(),
            },
        )

    return result


def _run_rebuild_job(job_id: str, issue_rows: list[dict[str, Any]]) -> None:
    try:
        rebuild_rag_index(issue_rows, job_id=job_id)
    except Exception as exc:
        _set_job(
            job_id,
            {
                "status": "failed",
                "error": str(exc),
                "updated_at": datetime.now(UTC).isoformat(),
            },
        )
    finally:
        _ACTIVE_THREADS.pop(job_id, None)


def start_rag_rebuild_job(issue_rows: list[dict[str, Any]]) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    _set_job(
        job_id,
        {
            "job_id": job_id,
            "status": "queued",
            "progress": 0.0,
            "created_at": now,
            "updated_at": now,
            "issue_count": len(issue_rows),
            "indexed_issues": 0,
            "skipped_issues": 0,
            "reused_issues": 0,
            "rebuilt_issues": 0,
            "chunk_count": 0,
            "current_issue_iid": None,
            "error": None,
            "result": None,
        },
    )

    thread = threading.Thread(
        target=_run_rebuild_job,
        args=(job_id, issue_rows),
        daemon=True,
        name=f"rag-rebuild-{job_id[:8]}",
    )
    _ACTIVE_THREADS[job_id] = thread
    thread.start()

    return {"job_id": job_id, "status": "queued"}


def _chunk_score(
    chunk: dict[str, Any], query_tokens: list[str], iid_hits: list[int]
) -> float:
    score = 0.0
    token_freq = Counter(chunk.get("tokens") or [])
    chunk_text = (chunk.get("text") or "").lower()

    for token in query_tokens:
        score += min(token_freq.get(token, 0), 3) * 2.0
        if token in chunk_text:
            score += 0.6

    for iid in iid_hits:
        if chunk.get("issue_iid") == iid:
            score += 12.0

    if chunk.get("source_type") == "discussion":
        score += 1.2

    updated_at = parse_dt(chunk.get("metadata", {}).get("updated_at"))
    if updated_at:
        days = max((datetime.now(UTC) - updated_at).days, 0)
        score += max(0.0, 4.0 - min(days, 30) / 10.0)

    return score


def search_rag_index(
    query: str,
    *,
    top_k: int = 8,
    state: str | None = None,
    labels: list[str] | None = None,
    assignees: list[str] | None = None,
) -> list[dict[str, Any]]:
    index = load_rag_index()
    chunks = index.get("chunks", [])
    if not chunks:
        return []

    state = (state or "").strip().lower()
    labels = [item.lower() for item in (labels or []) if item]
    assignees = [item.lower() for item in (assignees or []) if item]

    query_tokens = _tokenize(query)
    iid_hits = [int(value) for value in re.findall(r"#?(\d{1,8})", query)]

    results: list[dict[str, Any]] = []
    for chunk in chunks:
        metadata = chunk.get("metadata", {})

        if state and str(metadata.get("state", "")).lower() != state:
            continue

        chunk_labels = [str(item).lower() for item in metadata.get("labels", [])]
        if labels and not any(label in chunk_labels for label in labels):
            continue

        chunk_assignees = [str(item).lower() for item in metadata.get("assignees", [])]
        if assignees and not any(name in chunk_assignees for name in assignees):
            continue

        score = _chunk_score(chunk, query_tokens, iid_hits)
        if score <= 0:
            continue

        snippet = chunk.get("text", "")
        if len(snippet) > 360:
            snippet = snippet[:360].rstrip() + "..."

        results.append(
            {
                "chunk_id": chunk.get("chunk_id"),
                "issue_iid": chunk.get("issue_iid"),
                "title": chunk.get("title"),
                "source_type": chunk.get("source_type"),
                "score": round(score, 3),
                "snippet": snippet,
                "metadata": metadata,
                "text": chunk.get("text", ""),
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:top_k]


def build_rag_prompt(question: str, results: list[dict[str, Any]]) -> str:
    references: list[str] = []
    for idx, item in enumerate(results, start=1):
        references.append(
            f"[Source {idx}] issue=#{item['issue_iid']} chunk={item['chunk_id']} score={item['score']}\n"
            f"{item['text']}"
        )

    source_block = "\n\n".join(references)

    return (
        "你是一位 Issue 討論知識助理。\n"
        "請只根據提供的 Sources 回答，使用繁體中文。\n"
        "如果 Sources 不足以支持答案，要明確說資訊不足。\n"
        "回答時可以條列，但不要捏造不存在的結論。\n"
        "最後補一小段『來源』，列出引用到的 #IID。\n\n"
        f"問題：{question}\n\n"
        f"Sources:\n{source_block}"
    )
