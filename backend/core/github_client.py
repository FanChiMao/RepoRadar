from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import urlparse

import requests


class GitHubIssueProvider:
    provider_name = "github"

    def __init__(
        self,
        base_url: str = "https://github.com",
        token: str = "",
        verify_ssl: bool = True,
    ) -> None:
        parsed = urlparse((base_url or "https://github.com").rstrip("/"))
        host = parsed.netloc.lower()
        if host not in {"github.com", "api.github.com"}:
            raise ValueError("GitHub v1 currently supports github.com only.")

        self.web_base_url = "https://github.com"
        self.api_base_url = "https://api.github.com"
        self.verify_ssl = verify_ssl
        self.rate_limit_status: dict[str, str | None] = {}
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "RepoRadar",
            }
        )
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})

    @staticmethod
    def _validate_project_ref(project_ref: str) -> str:
        value = str(project_ref or "").strip().strip("/")
        parts = value.split("/")
        if len(parts) != 2 or not all(parts):
            raise ValueError("GitHub repository must use owner/repo format.")
        return value

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        tolerate_statuses: set[int] | None = None,
    ) -> requests.Response | None:
        tolerate_statuses = tolerate_statuses or set()
        url = f"{self.api_base_url}{path}"
        last_response: requests.Response | None = None

        for attempt in range(3):
            response = self.session.request(
                method,
                url,
                params=params,
                timeout=30,
                verify=self.verify_ssl,
            )
            last_response = response
            self._capture_rate_limit(response)
            if response.status_code in tolerate_statuses:
                return None
            if response.status_code not in {403, 429}:
                response.raise_for_status()
                return response

            remaining = response.headers.get("X-RateLimit-Remaining")
            is_rate_limited = response.status_code == 429 or remaining == "0"
            retry_after = response.headers.get("Retry-After")
            if attempt < 2 and (retry_after or is_rate_limited):
                delay = min(
                    max(int(retry_after) if str(retry_after).isdigit() else 1, 1), 5
                )
                time.sleep(delay)
                continue
            response.raise_for_status()

        if last_response is not None:
            last_response.raise_for_status()
        raise RuntimeError("GitHub API request failed.")

    def _capture_rate_limit(self, response: requests.Response) -> None:
        self.rate_limit_status = {
            "limit": response.headers.get("X-RateLimit-Limit"),
            "remaining": response.headers.get("X-RateLimit-Remaining"),
            "reset": response.headers.get("X-RateLimit-Reset"),
            "resource": response.headers.get("X-RateLimit-Resource"),
        }

    def _paginate(
        self, path: str, *, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        page = 1
        results: list[dict[str, Any]] = []
        while True:
            response = self._request(
                "GET", path, params={**(params or {}), "per_page": 100, "page": page}
            )
            assert response is not None
            batch = response.json()
            if not isinstance(batch, list):
                break
            results.extend(item for item in batch if isinstance(item, dict))
            if 'rel="next"' not in response.headers.get("Link", ""):
                break
            page += 1
        return results

    def fetch_project_issues(
        self, project_ref: str, state: str = "all"
    ) -> list[dict[str, Any]]:
        project_ref = self._validate_project_ref(project_ref)
        resolved_state = {"opened": "open", "closed": "closed"}.get(state, state)
        rows = self._paginate(
            f"/repos/{project_ref}/issues",
            params={"state": resolved_state, "sort": "updated", "direction": "desc"},
        )
        return [
            self._normalize_issue(item, project_ref)
            for item in rows
            if not item.get("pull_request")
        ]

    def fetch_issues_with_params(
        self, project_ref: str, params: dict[str, Any]
    ) -> list[dict[str, Any]]:
        project_ref = self._validate_project_ref(project_ref)
        request_params = dict(params)
        request_params["state"] = {"opened": "open", "closed": "closed"}.get(
            str(request_params.get("state") or "open"), request_params.get("state")
        )
        rows = self._paginate(f"/repos/{project_ref}/issues", params=request_params)
        return [
            self._normalize_issue(item, project_ref)
            for item in rows
            if not item.get("pull_request")
        ]

    def fetch_issue(self, project_ref: str, issue_iid: int) -> dict[str, Any]:
        project_ref = self._validate_project_ref(project_ref)
        response = self._request("GET", f"/repos/{project_ref}/issues/{issue_iid}")
        assert response is not None
        payload = response.json()
        if payload.get("pull_request"):
            raise ValueError("The GitHub URL points to a pull request, not an issue.")
        return self._normalize_issue(payload, project_ref)

    def fetch_issue_discussions(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        project_ref = self._validate_project_ref(project_ref)
        comments = self._paginate(f"/repos/{project_ref}/issues/{issue_iid}/comments")
        return [self._normalize_comment(comment) for comment in comments]

    def fetch_issue_related_merge_requests(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        project_ref = self._validate_project_ref(project_ref)
        timeline = self._paginate(
            f"/repos/{project_ref}/issues/{issue_iid}/timeline",
            params={"per_page": 100},
        )
        pull_numbers: set[int] = set()
        for event in timeline:
            source_issue = (event.get("source") or {}).get("issue") or {}
            number = source_issue.get("number")
            if source_issue.get("pull_request") and isinstance(number, int):
                pull_numbers.add(number)

        results: list[dict[str, Any]] = []
        for number in sorted(pull_numbers, reverse=True)[:20]:
            response = self._request(
                "GET",
                f"/repos/{project_ref}/pulls/{number}",
                tolerate_statuses={404},
            )
            if response is not None:
                results.append(self._normalize_pull_request(response.json()))
        return results

    def fetch_issue_links(
        self, project_ref: str, issue_iid: int
    ) -> list[dict[str, Any]]:
        project_ref = self._validate_project_ref(project_ref)
        endpoints = [
            (
                "blocks",
                "outbound",
                f"/repos/{project_ref}/issues/{issue_iid}/dependencies/blocking",
            ),
            (
                "is_blocked_by",
                "outbound",
                f"/repos/{project_ref}/issues/{issue_iid}/dependencies/blocked_by",
            ),
            ("parent", "inbound", f"/repos/{project_ref}/issues/{issue_iid}/parent"),
            (
                "sub_issue",
                "outbound",
                f"/repos/{project_ref}/issues/{issue_iid}/sub_issues",
            ),
        ]
        links: list[dict[str, Any]] = []
        seen: set[tuple[str, int]] = set()
        for link_type, direction, path in endpoints:
            response = self._request("GET", path, tolerate_statuses={404, 410, 422})
            if response is None:
                continue
            payload = response.json()
            rows = payload if isinstance(payload, list) else [payload]
            for row in rows:
                if not isinstance(row, dict) or row.get("pull_request"):
                    continue
                number = row.get("number")
                key = (link_type, int(number or 0))
                if not number or key in seen:
                    continue
                seen.add(key)
                links.append(
                    {
                        "id": row.get("id"),
                        "link_type": link_type,
                        "direction": direction,
                        "issue": self._normalize_linked_issue_ref(row),
                    }
                )
        return links

    def test_connection(self, project_ref: str) -> dict[str, Any]:
        project_ref = self._validate_project_ref(project_ref)
        response = self._request("GET", f"/repos/{project_ref}")
        assert response is not None
        payload = response.json()
        return {
            "provider": self.provider_name,
            "source_ref": payload.get("full_name") or project_ref,
            "name": payload.get("name"),
            "private": bool(payload.get("private")),
            "default_branch": payload.get("default_branch"),
            "rate_limit_remaining": response.headers.get("X-RateLimit-Remaining"),
            "rate_limit": self.rate_limit_status,
        }

    def capabilities(self) -> dict[str, Any]:
        return {
            "issue_due_date": False,
            "milestone_start_date": False,
            "milestone_due_date": True,
            "discussion_threads": False,
            "related_change_kind": "pull_request",
            "issue_dependencies": True,
            "sub_issues": True,
            "pipeline_status": False,
            "anonymous_public_read": True,
            "bounded_concurrency": 1,
        }

    @staticmethod
    def _task_completion_status(body: str) -> dict[str, int]:
        matches = re.findall(r"(?im)^\s*[-*]\s+\[([ xX])\]\s+", body or "")
        return {
            "count": len(matches),
            "completed_count": sum(1 for value in matches if value.lower() == "x"),
        }

    @staticmethod
    def _normalize_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
        if not user:
            return None
        return {
            "id": user.get("id"),
            "username": user.get("login"),
            "name": user.get("name") or user.get("login"),
            "avatar_url": user.get("avatar_url"),
            "web_url": user.get("html_url"),
        }

    @classmethod
    def _normalize_issue(
        cls, attrs: dict[str, Any], project_ref: str
    ) -> dict[str, Any]:
        milestone = attrs.get("milestone") or {}
        labels = [
            item.get("name") if isinstance(item, dict) else str(item)
            for item in attrs.get("labels", [])
        ]
        labels = [value for value in labels if value]
        return {
            "id": attrs.get("id"),
            "iid": attrs.get("number"),
            "project_id": project_ref,
            "provider": "github",
            "source_ref": project_ref,
            "schema_version": 2,
            "relation_counts_known": False,
            "title": attrs.get("title"),
            "description": attrs.get("body") or "",
            "state": "opened" if attrs.get("state") == "open" else "closed",
            "web_url": attrs.get("html_url"),
            "labels": labels,
            "author": cls._normalize_user(attrs.get("user")),
            "assignees": list(
                filter(
                    None,
                    (cls._normalize_user(item) for item in attrs.get("assignees", [])),
                )
            ),
            "milestone": (
                {
                    "id": milestone.get("id"),
                    "iid": milestone.get("number"),
                    "title": milestone.get("title"),
                    "description": milestone.get("description"),
                    "state": milestone.get("state"),
                    "start_date": None,
                    "due_date": (milestone.get("due_on") or "")[:10] or None,
                }
                if milestone
                else None
            ),
            "references": {"relative": f"#{attrs.get('number')}"},
            "created_at": attrs.get("created_at"),
            "updated_at": attrs.get("updated_at"),
            "closed_at": attrs.get("closed_at"),
            "due_date": None,
            "confidential": False,
            "discussion_locked": attrs.get("locked"),
            "issue_type": "issue",
            "severity": None,
            "merge_requests_count": 0,
            "blocking_issues_count": 0,
            "task_completion_status": cls._task_completion_status(
                attrs.get("body") or ""
            ),
            "time_stats": None,
            "user_notes_count": attrs.get("comments", 0),
            "raw": attrs,
        }

    @classmethod
    def _normalize_comment(cls, comment: dict[str, Any]) -> dict[str, Any]:
        author = cls._normalize_user(comment.get("user")) or {}
        note = {
            "id": comment.get("id"),
            "body": comment.get("body") or "",
            "author_name": author.get("name") or "",
            "author_username": author.get("username") or "",
            "author_avatar_url": author.get("avatar_url") or "",
            "created_at": comment.get("created_at"),
            "updated_at": comment.get("updated_at"),
        }
        return {"id": str(comment.get("id")), "notes": [note]}

    @classmethod
    def _normalize_pull_request(cls, attrs: dict[str, Any]) -> dict[str, Any]:
        author = cls._normalize_user(attrs.get("user")) or {}
        return {
            "id": attrs.get("id"),
            "iid": attrs.get("number"),
            "kind": "pull_request",
            "relation_kind": "cross_referenced",
            "title": attrs.get("title"),
            "state": "merged" if attrs.get("merged_at") else attrs.get("state"),
            "draft": bool(attrs.get("draft")),
            "web_url": attrs.get("html_url"),
            "created_at": attrs.get("created_at"),
            "updated_at": attrs.get("updated_at"),
            "merged_at": attrs.get("merged_at"),
            "merge_status": attrs.get("mergeable_state"),
            "source_branch": (attrs.get("head") or {}).get("ref"),
            "target_branch": (attrs.get("base") or {}).get("ref"),
            "author_name": author.get("name") or "",
            "author_username": author.get("username") or "",
            "author_avatar_url": author.get("avatar_url") or "",
            "head_pipeline_status": None,
        }

    @classmethod
    def _normalize_linked_issue_ref(cls, attrs: dict[str, Any]) -> dict[str, Any]:
        milestone = attrs.get("milestone") or {}
        return {
            "iid": attrs.get("number"),
            "title": attrs.get("title"),
            "state": "opened" if attrs.get("state") == "open" else "closed",
            "web_url": attrs.get("html_url"),
            "labels": [
                item.get("name") if isinstance(item, dict) else str(item)
                for item in attrs.get("labels", [])
            ],
            "assignees": [
                item.get("name") or item.get("login")
                for item in attrs.get("assignees", [])
                if item.get("name") or item.get("login")
            ],
            "milestone": milestone.get("title"),
            "due_date": (milestone.get("due_on") or "")[:10] or None,
        }
