"""Per-repo snapshots of the issues cache + RAG index, plus a small registry.

The rest of the app works against a single *active* repo: one global
``issues_cache.json`` and one ``rag_index.json``, wiped whenever the connection
changes. Project Pulse, however, needs to generate reports for several repos
without their data mixing (Case 7). Rather than refactor the RAG build to be
repo-aware, we keep the active-repo flow untouched and *snapshot* its cache +
index into a per-repo folder keyed by a stable ``repo_id``. Report generation
then reads the snapshot for a schedule's repo, never the live global files.

A repo is (re)snapshotted whenever the active repo is synced or re-indexed.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from . import config_store, rag_service
from .config_store import data_dir
from .provider import get_connection, source_identity
from .utils import read_json, write_json

REGISTRY_PATH = data_dir() / "repos.json"


def repos_dir() -> Path:
    base = data_dir() / "repos"
    base.mkdir(parents=True, exist_ok=True)
    return base


def repo_id_for(config: dict[str, Any]) -> str:
    """Stable, filesystem-safe id derived from the source identity."""
    identity = source_identity(config)
    return hashlib.sha1(identity.encode("utf-8")).hexdigest()[:16]


def repo_name_for(config: dict[str, Any]) -> str:
    if config.get("import_file"):
        return Path(str(config["import_file"])).stem or "import"
    connection = get_connection(config)
    ref = str(connection.get("project_ref") or "").strip()
    if ref:
        return ref.rstrip("/").split("/")[-1]
    return str(connection.get("provider") or "repo")


def _repo_dir(repo_id: str) -> Path:
    directory = repos_dir() / repo_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def repo_cache_path(repo_id: str) -> Path:
    return _repo_dir(repo_id) / "issues_cache.json"


def repo_index_path(repo_id: str) -> Path:
    return _repo_dir(repo_id) / "rag_index.json"


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #
def load_registry() -> list[dict[str, Any]]:
    data = read_json(REGISTRY_PATH, [])
    return data if isinstance(data, list) else []


def list_repos() -> list[dict[str, Any]]:
    return load_registry()


def get_repo(repo_id: str) -> dict[str, Any] | None:
    for entry in load_registry():
        if entry.get("repo_id") == repo_id:
            return entry
    return None


def _upsert_registry(entry: dict[str, Any]) -> None:
    registry = [
        item for item in load_registry() if item.get("repo_id") != entry["repo_id"]
    ]
    registry.append(entry)
    registry.sort(key=lambda item: str(item.get("repo_name") or "").lower())
    write_json(REGISTRY_PATH, registry)


# --------------------------------------------------------------------------- #
# Snapshot + read
# --------------------------------------------------------------------------- #
def snapshot_active_repo(config: dict[str, Any]) -> dict[str, Any] | None:
    """Copy the active repo's global cache + index into its per-repo folder and
    record it in the registry. Safe to call on every sync / reindex; a no-op when
    there is nothing cached yet. Never raises into the caller's flow."""
    try:
        repo_id = repo_id_for(config)
        issues = read_json(config_store.CACHE_PATH, [])
        index = read_json(rag_service.RAG_INDEX_PATH, {})
        if not issues and not (isinstance(index, dict) and index.get("chunks")):
            return None

        if issues:
            write_json(repo_cache_path(repo_id), issues)
        if isinstance(index, dict) and index.get("chunks"):
            write_json(repo_index_path(repo_id), index)

        is_import = bool(config.get("import_file"))
        connection = {} if is_import else get_connection(config)
        entry = {
            "repo_id": repo_id,
            "repo_name": repo_name_for(config),
            "provider": "import" if is_import else connection["provider"],
            "source_ref": source_identity(config),
            # Connection details so a bound repo can be re-synced on demand even
            # when it is not the currently-active repo (token comes from the
            # provider's global connection).
            "base_url": "" if is_import else connection.get("base_url", ""),
            "project_ref": "" if is_import else connection.get("project_ref", ""),
            "import_file": str(config.get("import_file") or "") if is_import else "",
            "issue_count": len(issues) if isinstance(issues, list) else 0,
            "index_built_at": (
                index.get("built_at") if isinstance(index, dict) else None
            ),
            "snapshot_at": datetime.now(UTC).isoformat(),
        }
        _upsert_registry(entry)
        return entry
    except Exception:  # noqa: BLE001 — snapshotting must never break sync/reindex
        return None


def update_repo_cache(repo_id: str, issues: list[dict[str, Any]]) -> None:
    """Overwrite a repo's per-repo issue cache and refresh its registry counters.
    Used by the on-demand 'sync the bound repo before sending' flow."""
    write_json(repo_cache_path(repo_id), issues)
    entry = get_repo(repo_id)
    if entry is not None:
        entry["issue_count"] = len(issues) if isinstance(issues, list) else 0
        entry["snapshot_at"] = datetime.now(UTC).isoformat()
        _upsert_registry(entry)


def load_repo_issues(repo_id: str) -> list[dict[str, Any]]:
    data = read_json(repo_cache_path(repo_id), [])
    return data if isinstance(data, list) else []


def load_repo_index(repo_id: str) -> dict[str, Any]:
    data = read_json(repo_index_path(repo_id), {})
    return data if isinstance(data, dict) else {}
