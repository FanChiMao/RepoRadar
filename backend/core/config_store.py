from __future__ import annotations

import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from .utils import read_json, write_json

# 載入 backend/.env，讓 Azure LLM 等機密透過環境變數提供（該檔已被 .gitignore 排除）。
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ModuleNotFoundError:
    pass

DEFAULT_CONFIG: dict[str, Any] = {
    "active_provider": "gitlab",
    "connections": {
        "gitlab": {
            "base_url": "",
            "token": "",
            "project_ref": "",
            "project_ref_history": [],
            "verify_ssl": False,
        },
        "github": {
            "base_url": "https://github.com",
            "token": "",
            "project_ref": "",
            "project_ref_history": [],
            "verify_ssl": True,
        },
    },
    "import_file": "",
    "gemini_api_key": "",
    "enable_daily_sync": True,
    "daily_sync_time": "09:00",
    "enable_weekly_report": True,
    "weekly_report_time": "17:30",
}

MAX_PROJECT_REF_HISTORY = 10


def data_dir() -> Path:
    root = os.environ.get("REPO_RADAR_DATA_DIR")
    base = Path(root) if root else Path(__file__).resolve().parents[1] / "data"
    base.mkdir(parents=True, exist_ok=True)
    return base


CONFIG_PATH = data_dir() / "config.json"
CACHE_PATH = data_dir() / "issues_cache.json"
META_PATH = data_dir() / "meta.json"
REPORT_DIR = data_dir() / "reports"


def normalize_project_ref_history(
    current_value: Any, history: Any, limit: int = MAX_PROJECT_REF_HISTORY
) -> list[str]:
    items: list[str] = []

    def push(value: Any) -> None:
        text = str(value).strip() if value is not None else ""
        if text and text not in items:
            items.append(text)

    push(current_value)
    if isinstance(history, list):
        for entry in history:
            push(entry)

    return items[:limit]


def load_config() -> dict[str, Any]:
    return _normalize_config(read_json(CONFIG_PATH, {}))


def save_config(payload: dict[str, Any]) -> dict[str, Any]:
    existing = load_config()
    merged_payload = deepcopy(payload)

    incoming_connections = merged_payload.get("connections") or {}
    for provider in ("gitlab", "github"):
        existing_connection = (existing.get("connections") or {}).get(provider) or {}
        incoming = deepcopy(existing_connection)
        incoming.update(incoming_connections.get(provider) or {})
        if not incoming.get("token"):
            incoming["token"] = existing_connection.get("token") or ""
        incoming_connections[provider] = incoming
    merged_payload["connections"] = incoming_connections

    if not merged_payload.get("gemini_api_key"):
        merged_payload["gemini_api_key"] = existing.get("gemini_api_key") or ""

    merged = _normalize_config(merged_payload)
    write_json(CONFIG_PATH, _persistable_config(merged))
    return merged


def public_config(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    config = deepcopy(payload or load_config())
    for connection in (config.get("connections") or {}).values():
        token = str(connection.get("token") or "")
        connection["token"] = ""
        connection["token_configured"] = bool(token)
    gemini_key = str(config.get("gemini_api_key") or "")
    config["gemini_api_key"] = ""
    config["gemini_api_key_configured"] = bool(gemini_key)
    config.pop("gitlab_url", None)
    config.pop("token", None)
    config.pop("project_ref", None)
    config.pop("project_ref_history", None)
    return config


def _normalize_connection(
    provider: str, value: Any, fallback: dict[str, Any]
) -> dict[str, Any]:
    connection = deepcopy(fallback)
    if isinstance(value, dict):
        connection.update(value)
    connection["base_url"] = str(connection.get("base_url") or "").strip().rstrip("/")
    connection["token"] = str(connection.get("token") or "").strip()
    connection["project_ref"] = str(connection.get("project_ref") or "").strip()
    connection["project_ref_history"] = normalize_project_ref_history(
        connection["project_ref"], connection.get("project_ref_history", [])
    )
    connection["verify_ssl"] = bool(connection.get("verify_ssl", provider == "github"))
    if provider == "github" and not connection["base_url"]:
        connection["base_url"] = "https://github.com"
    return connection


def _normalize_config(raw: Any) -> dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    payload = deepcopy(DEFAULT_CONFIG)
    payload.update(
        {
            key: value
            for key, value in source.items()
            if key
            not in {
                "connections",
                "gitlab_url",
                "token",
                "project_ref",
                "project_ref_history",
            }
        }
    )

    connections = deepcopy(DEFAULT_CONFIG["connections"])
    raw_connections = source.get("connections") or {}
    if isinstance(raw_connections, dict):
        for provider in ("gitlab", "github"):
            if isinstance(raw_connections.get(provider), dict):
                connections[provider].update(raw_connections[provider])

    # Migrate the original flat GitLab settings without breaking existing installs.
    if any(key in source for key in ("gitlab_url", "token", "project_ref")):
        connections["gitlab"].update(
            {
                "base_url": source.get("gitlab_url")
                or connections["gitlab"]["base_url"],
                "token": source.get("token") or connections["gitlab"]["token"],
                "project_ref": source.get("project_ref")
                or connections["gitlab"]["project_ref"],
                "project_ref_history": source.get("project_ref_history")
                or connections["gitlab"]["project_ref_history"],
            }
        )

    payload["active_provider"] = (
        str(payload.get("active_provider") or "gitlab").strip().lower()
    )
    if payload["active_provider"] not in {"gitlab", "github"}:
        payload["active_provider"] = "gitlab"
    payload["connections"] = {
        provider: _normalize_connection(
            provider, connections[provider], DEFAULT_CONFIG["connections"][provider]
        )
        for provider in ("gitlab", "github")
    }

    # Temporary aliases keep older backend paths compatible during migration.
    active = payload["connections"][payload["active_provider"]]
    payload["gitlab_url"] = payload["connections"]["gitlab"]["base_url"]
    payload["token"] = active["token"]
    payload["project_ref"] = active["project_ref"]
    payload["project_ref_history"] = active["project_ref_history"]
    return payload


def _persistable_config(config: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(config)
    for key in ("gitlab_url", "token", "project_ref", "project_ref_history"):
        payload.pop(key, None)
    return payload


def load_meta() -> dict[str, Any]:
    return read_json(
        META_PATH,
        {
            "last_sync": None,
            "last_report": None,
            "latest_report_path": None,
            "scheduler": {},
        },
    )


def save_meta(payload: dict[str, Any]) -> dict[str, Any]:
    write_json(META_PATH, payload)
    return payload
