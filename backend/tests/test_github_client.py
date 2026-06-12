from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.github_client import GitHubIssueProvider  # noqa: E402


def response(payload: object, status: int = 200, headers: dict | None = None):
    value = requests.Response()
    value.status_code = status
    value._content = json.dumps(payload).encode("utf-8")
    value.headers["Content-Type"] = "application/json"
    for key, val in (headers or {}).items():
        value.headers[key] = val
    return value


class InitTests(unittest.TestCase):
    def test_rejects_non_github_host(self) -> None:
        with self.assertRaises(ValueError):
            GitHubIssueProvider(base_url="https://gitlab.com")

    def test_token_sets_authorization_header(self) -> None:
        provider = GitHubIssueProvider(token="secret")
        self.assertEqual("Bearer secret", provider.session.headers["Authorization"])

    def test_no_token_has_no_authorization_header(self) -> None:
        provider = GitHubIssueProvider()
        self.assertNotIn("Authorization", provider.session.headers)


class ValidateProjectRefTests(unittest.TestCase):
    def test_rejects_bad_format(self) -> None:
        with self.assertRaises(ValueError):
            GitHubIssueProvider._validate_project_ref("justrepo")

    def test_accepts_owner_repo(self) -> None:
        self.assertEqual(
            "owner/repo", GitHubIssueProvider._validate_project_ref("/owner/repo/")
        )


class PaginationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GitHubIssueProvider()

    def test_follows_link_next_then_stops(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            side_effect=[
                response(
                    [{"id": 1, "number": 10, "title": "A", "state": "open"}],
                    headers={"Link": '<https://api/next>; rel="next"'},
                ),
                response(
                    [{"id": 2, "number": 11, "title": "B", "state": "closed"}],
                ),
            ]
        )
        issues = self.provider.fetch_project_issues("owner/repo")
        self.assertEqual([10, 11], [item["iid"] for item in issues])
        self.assertEqual(2, self.provider.session.request.call_count)

    def test_non_list_payload_breaks(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "not a list"})
        )
        self.assertEqual([], self.provider.fetch_project_issues("owner/repo"))

    def test_deep_pagination_422_stops_gracefully(self) -> None:
        # Large repos hit GitHub's deep-pagination cap: page 1 succeeds, the
        # next page returns 422. The sync should keep page 1 and flag truncation
        # instead of raising.
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            side_effect=[
                response(
                    [{"id": 1, "number": 10, "title": "A", "state": "open"}],
                    headers={"Link": '<https://api/next>; rel="next"'},
                ),
                response(
                    {
                        "message": "In order to keep the API fast for everyone, "
                        "pagination is limited for this resource."
                    },
                    422,
                ),
            ]
        )
        issues = self.provider.fetch_project_issues("owner/repo")
        self.assertEqual([10], [item["iid"] for item in issues])
        self.assertTrue(self.provider.last_page_truncated)

    def test_first_page_422_still_raises(self) -> None:
        # A 422 on the very first page is a genuine bad request, not the
        # deep-pagination cap, so it must propagate.
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "Validation failed"}, 422)
        )
        with self.assertRaises(requests.exceptions.HTTPError):
            self.provider.fetch_project_issues("owner/repo")
        self.assertFalse(self.provider.last_page_truncated)


class RequestRetryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GitHubIssueProvider()

    def test_tolerated_status_returns_none(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "missing"}, 404)
        )
        result = self.provider._request(
            "GET", "/repos/owner/repo/parent", tolerate_statuses={404}
        )
        self.assertIsNone(result)

    def test_rate_limit_retries_then_raises(self) -> None:
        limited = response(
            {"message": "rate limited"},
            403,
            headers={"X-RateLimit-Remaining": "0", "Retry-After": "1"},
        )
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=limited
        )
        with patch("core.github_client.time.sleep") as sleep:
            with self.assertRaises(requests.exceptions.HTTPError):
                self.provider._request("GET", "/repos/owner/repo")
        self.assertEqual(3, self.provider.session.request.call_count)
        self.assertEqual(2, sleep.call_count)


class FetchIssueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GitHubIssueProvider()

    def test_fetch_issue_normalizes(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response(
                {
                    "id": 1,
                    "number": 7,
                    "title": "X",
                    "state": "open",
                    "body": "- [x] a\n- [ ] b",
                }
            )
        )
        issue = self.provider.fetch_issue("owner/repo", 7)
        self.assertEqual(7, issue["iid"])
        self.assertEqual("opened", issue["state"])
        self.assertEqual(
            {"count": 2, "completed_count": 1}, issue["task_completion_status"]
        )

    def test_fetch_issue_pull_request_raises(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response({"number": 7, "pull_request": {"url": "x"}})
        )
        with self.assertRaises(ValueError):
            self.provider.fetch_issue("owner/repo", 7)

    def test_fetch_issues_with_params_maps_state(self) -> None:
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response(
                [{"id": 1, "number": 10, "title": "A", "state": "closed"}]
            )
        )
        issues = self.provider.fetch_issues_with_params(
            "owner/repo", {"state": "closed"}
        )
        self.assertEqual([10], [item["iid"] for item in issues])


class FetchIssueLinksTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GitHubIssueProvider()

    def test_collects_dependencies_and_tolerates_404(self) -> None:
        def fake_request(method, url, **kwargs):
            if url.endswith("/dependencies/blocking"):
                return response(
                    [{"id": 5, "number": 20, "title": "blocked", "state": "open"}]
                )
            return response({"message": "not found"}, 404)

        self.provider.session.request = Mock(  # type: ignore[method-assign]
            side_effect=fake_request
        )
        links = self.provider.fetch_issue_links("owner/repo", 7)
        self.assertEqual(1, len(links))
        self.assertEqual("blocks", links[0]["link_type"])
        self.assertEqual(20, links[0]["issue"]["iid"])


class TestConnectionTests(unittest.TestCase):
    def test_returns_repo_metadata(self) -> None:
        provider = GitHubIssueProvider()
        provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=response(
                {
                    "full_name": "owner/repo",
                    "name": "repo",
                    "private": True,
                    "default_branch": "main",
                },
                headers={"X-RateLimit-Remaining": "55"},
            )
        )
        result = provider.test_connection("owner/repo")
        self.assertEqual("owner/repo", result["source_ref"])
        self.assertTrue(result["private"])
        self.assertEqual("main", result["default_branch"])
        self.assertEqual("55", result["rate_limit_remaining"])


class CapabilitiesTests(unittest.TestCase):
    def test_reports_github_capabilities(self) -> None:
        caps = GitHubIssueProvider().capabilities()
        self.assertEqual("pull_request", caps["related_change_kind"])
        self.assertTrue(caps["sub_issues"])
        self.assertTrue(caps["anonymous_public_read"])
        self.assertFalse(caps["discussion_threads"])


class NormalizeLinkedIssueRefTests(unittest.TestCase):
    def test_maps_fields(self) -> None:
        ref = GitHubIssueProvider._normalize_linked_issue_ref(
            {
                "number": 9,
                "title": "Linked",
                "state": "open",
                "html_url": "https://github.com/o/r/issues/9",
                "labels": [{"name": "bug"}, "plain"],
                "assignees": [{"login": "dev"}],
                "milestone": {"title": "M", "due_on": "2026-01-01T00:00:00Z"},
            }
        )
        self.assertEqual(9, ref["iid"])
        self.assertEqual("opened", ref["state"])
        self.assertEqual(["bug", "plain"], ref["labels"])
        self.assertEqual(["dev"], ref["assignees"])
        self.assertEqual("2026-01-01", ref["due_date"])


if __name__ == "__main__":
    unittest.main()
