from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


class GitLabIssueClient:
    provider_name = "gitlab"

    def __init__(self, base_url: str, token: str, verify_ssl: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.verify_ssl = verify_ssl
        self.session = requests.Session()
        self.session.headers.update({"PRIVATE-TOKEN": token})

    def _encode_project_ref(self, project_ref: str) -> str:
        return (
            quote(project_ref, safe="")
            if not str(project_ref).isdigit()
            else str(project_ref)
        )

    def fetch_project_issues(
        self, project_ref: str, state: str = "all"
    ) -> list[dict[str, Any]]:
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        base_endpoint = f"{self.base_url}/api/v4/projects/{encoded}/issues"

        page = 1
        all_issues: list[dict[str, Any]] = []
        while True:
            response = self.session.get(
                base_endpoint,
                params={
                    "state": state,
                    "per_page": 100,
                    "page": page,
                    "order_by": "updated_at",
                    "sort": "desc",
                },
                timeout=30,
                verify=self.verify_ssl,
            )
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            all_issues.extend(
                self._normalize_issue(item, project_ref) for item in batch
            )
            page += 1

        return all_issues

    def fetch_issues_with_params(
        self, project_ref: str, params: dict[str, Any]
    ) -> list[dict[str, Any]]:
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        endpoint = f"{self.base_url}/api/v4/projects/{encoded}/issues"

        page = 1
        results: list[dict[str, Any]] = []
        while True:
            response = self.session.get(
                endpoint,
                params={**params, "per_page": 100, "page": page},
                timeout=30,
                verify=self.verify_ssl,
            )
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            results.extend(self._normalize_issue(item, project_ref) for item in batch)
            if len(batch) < 100:
                break
            page += 1

        return results

    def fetch_issue(self, project_ref: str, issue_iid: int) -> dict[str, Any]:
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        endpoint = f"{self.base_url}/api/v4/projects/{encoded}/issues/{issue_iid}"
        response = self.session.get(endpoint, timeout=30, verify=self.verify_ssl)
        response.raise_for_status()
        return self._normalize_issue(response.json(), project_ref)

    def fetch_issue_discussions(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        """Fetch all discussion threads for a specific issue."""
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        endpoint = (
            f"{self.base_url}/api/v4/projects/{encoded}/issues/{issue_iid}/discussions"
        )

        page = 1
        all_discussions: list[dict[str, Any]] = []
        while True:
            response = self.session.get(
                endpoint,
                params={"per_page": 100, "page": page},
                timeout=30,
                verify=self.verify_ssl,
            )
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            all_discussions.extend(batch)
            page += 1

        return [self._normalize_discussion(d) for d in all_discussions]

    def fetch_issue_related_merge_requests(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        """Fetch related merge requests for a specific issue."""
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        endpoint = f"{self.base_url}/api/v4/projects/{encoded}/issues/{issue_iid}/related_merge_requests"

        response = self.session.get(
            endpoint,
            timeout=30,
            verify=self.verify_ssl,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            return []
        return [self._normalize_merge_request(item) for item in payload]

    def fetch_issue_links(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        """Fetch linked issues for a specific issue."""
        if not self.base_url or not project_ref:
            raise ValueError("GitLab URL and project reference are required.")

        encoded = self._encode_project_ref(project_ref)
        endpoint = f"{self.base_url}/api/v4/projects/{encoded}/issues/{issue_iid}/links"

        response = self.session.get(
            endpoint,
            timeout=30,
            verify=self.verify_ssl,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            return []
        return [self._normalize_issue_link(issue_iid, item) for item in payload]

    def test_connection(self, project_ref: str) -> dict[str, Any]:
        encoded = self._encode_project_ref(project_ref)
        response = self.session.get(
            f"{self.base_url}/api/v4/projects/{encoded}",
            timeout=30,
            verify=self.verify_ssl,
        )
        response.raise_for_status()
        payload = response.json()
        return {
            "provider": self.provider_name,
            "source_ref": payload.get("path_with_namespace") or project_ref,
            "name": payload.get("name"),
            "private": payload.get("visibility") == "private",
            "default_branch": payload.get("default_branch"),
            "rate_limit_remaining": response.headers.get("RateLimit-Remaining"),
        }

    def capabilities(self) -> dict[str, Any]:
        return {
            "issue_due_date": True,
            "milestone_start_date": True,
            "milestone_due_date": True,
            "discussion_threads": True,
            "related_change_kind": "merge_request",
            "issue_dependencies": True,
            "sub_issues": False,
            "pipeline_status": True,
            "anonymous_public_read": False,
            "bounded_concurrency": 1,
        }

    @staticmethod
    def _normalize_discussion(disc: dict[str, Any]) -> dict[str, Any]:
        notes = []
        for note in disc.get("notes", []):
            if note.get("system"):
                continue
            author = note.get("author") or {}
            notes.append(
                {
                    "id": note.get("id"),
                    "body": note.get("body", ""),
                    "author_name": author.get("name", ""),
                    "author_username": author.get("username", ""),
                    "author_avatar_url": author.get("avatar_url", ""),
                    "created_at": note.get("created_at"),
                    "updated_at": note.get("updated_at"),
                }
            )
        return {
            "id": disc.get("id"),
            "notes": notes,
        }

    @staticmethod
    def _normalize_merge_request(attrs: dict[str, Any]) -> dict[str, Any]:
        author = attrs.get("author") or {}
        head_pipeline = attrs.get("head_pipeline") or {}
        return {
            "id": attrs.get("id"),
            "iid": attrs.get("iid"),
            "kind": "merge_request",
            "relation_kind": "related",
            "title": attrs.get("title"),
            "state": attrs.get("state"),
            "draft": bool(attrs.get("draft") or attrs.get("work_in_progress")),
            "web_url": attrs.get("web_url"),
            "created_at": attrs.get("created_at"),
            "updated_at": attrs.get("updated_at"),
            "merged_at": attrs.get("merged_at"),
            "merge_status": attrs.get("merge_status")
            or attrs.get("detailed_merge_status"),
            "source_branch": attrs.get("source_branch"),
            "target_branch": attrs.get("target_branch"),
            "author_name": author.get("name") or "",
            "author_username": author.get("username") or "",
            "author_avatar_url": author.get("avatar_url") or "",
            "head_pipeline_status": head_pipeline.get("status"),
        }

    @staticmethod
    def _normalize_issue_link(
        current_issue_iid: int, attrs: dict[str, Any]
    ) -> dict[str, Any]:
        source_issue = attrs.get("source_issue") or {}
        target_issue = attrs.get("target_issue") or {}
        source_iid = source_issue.get("iid")
        target_iid = target_issue.get("iid")
        has_nested_issues = bool(source_issue or target_issue)

        if not has_nested_issues and attrs.get("iid") is not None:
            linked_issue = attrs
            direction = "unknown"
        elif source_iid == current_issue_iid:
            linked_issue = target_issue
            direction = "outbound"
        elif target_iid == current_issue_iid:
            linked_issue = source_issue
            direction = "inbound"
        else:
            linked_issue = target_issue or source_issue
            direction = "unknown"

        return {
            "id": attrs.get("id"),
            "link_type": attrs.get("link_type") or "relates_to",
            "direction": direction,
            "issue": GitLabIssueClient._normalize_linked_issue_ref(linked_issue),
        }

    @staticmethod
    def _normalize_linked_issue_ref(attrs: dict[str, Any]) -> dict[str, Any]:
        milestone = attrs.get("milestone") or {}
        return {
            "iid": attrs.get("iid"),
            "title": attrs.get("title"),
            "state": attrs.get("state"),
            "web_url": attrs.get("web_url"),
            "labels": attrs.get("labels") or [],
            "assignees": [
                item.get("name")
                for item in attrs.get("assignees", [])
                if item.get("name")
            ],
            "milestone": milestone.get("title"),
            "due_date": attrs.get("due_date") or milestone.get("due_date"),
        }

    @staticmethod
    def load_local_json(file_path: str) -> list[dict[str, Any]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"JSON file not found: {file_path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError("Imported JSON must be a list of issues.")
        return payload

    @staticmethod
    def _normalize_issue(
        attrs: dict[str, Any], source_ref: str | None = None
    ) -> dict[str, Any]:
        def nested_get(
            obj: dict[str, Any] | None, key: str, default: Any = None
        ) -> Any:
            if obj is None:
                return default
            return obj.get(key, default)

        return {
            "id": attrs.get("id"),
            "iid": attrs.get("iid"),
            "project_id": attrs.get("project_id"),
            "provider": "gitlab",
            "source_ref": source_ref or attrs.get("project_id"),
            "schema_version": 2,
            "relation_counts_known": True,
            "title": attrs.get("title"),
            "description": attrs.get("description"),
            "state": attrs.get("state"),
            "web_url": attrs.get("web_url"),
            "labels": attrs.get("labels", []),
            "author": (
                {
                    "id": nested_get(attrs.get("author"), "id"),
                    "username": nested_get(attrs.get("author"), "username"),
                    "name": nested_get(attrs.get("author"), "name"),
                    "web_url": nested_get(attrs.get("author"), "web_url"),
                }
                if attrs.get("author")
                else None
            ),
            "assignees": [
                {
                    "id": item.get("id"),
                    "username": item.get("username"),
                    "name": item.get("name"),
                    "avatar_url": item.get("avatar_url"),
                    "web_url": item.get("web_url"),
                }
                for item in attrs.get("assignees", [])
            ],
            "milestone": (
                {
                    "id": nested_get(attrs.get("milestone"), "id"),
                    "iid": nested_get(attrs.get("milestone"), "iid"),
                    "title": nested_get(attrs.get("milestone"), "title"),
                    "description": nested_get(attrs.get("milestone"), "description"),
                    "state": nested_get(attrs.get("milestone"), "state"),
                    "start_date": nested_get(attrs.get("milestone"), "start_date"),
                    "due_date": nested_get(attrs.get("milestone"), "due_date"),
                }
                if attrs.get("milestone")
                else None
            ),
            "references": attrs.get("references"),
            "created_at": attrs.get("created_at"),
            "updated_at": attrs.get("updated_at"),
            "closed_at": attrs.get("closed_at"),
            "due_date": attrs.get("due_date"),
            "confidential": attrs.get("confidential"),
            "discussion_locked": attrs.get("discussion_locked"),
            "issue_type": attrs.get("issue_type"),
            "severity": attrs.get("severity"),
            "merge_requests_count": attrs.get("merge_requests_count", 0),
            "blocking_issues_count": attrs.get("blocking_issues_count", 0),
            "task_completion_status": attrs.get("task_completion_status"),
            "time_stats": attrs.get("time_stats"),
            "user_notes_count": attrs.get("user_notes_count", 0),
            "raw": attrs,
        }
