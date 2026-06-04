from __future__ import annotations

import json
import unittest
from unittest.mock import Mock, patch

import requests

from backend.core.github_client import GitHubIssueProvider
from backend.core.gitlab_client import GitLabIssueClient


def response(payload: object, status: int = 200) -> requests.Response:
    value = requests.Response()
    value.status_code = status
    value._content = json.dumps(payload).encode("utf-8")
    value.headers["Content-Type"] = "application/json"
    return value


class GitHubProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = GitHubIssueProvider()

    def test_project_issue_list_excludes_pull_requests(self) -> None:
        self.provider._paginate = lambda *_args, **_kwargs: [  # type: ignore[method-assign]
            {
                "id": 1,
                "number": 12,
                "title": "Issue",
                "body": "- [x] done\n- [ ] todo",
                "state": "open",
                "labels": [{"name": "bug"}],
                "assignees": [],
                "comments": 2,
            },
            {
                "id": 2,
                "number": 13,
                "title": "PR",
                "state": "open",
                "pull_request": {"url": "https://api.github.com/pulls/13"},
            },
        ]

        issues = self.provider.fetch_project_issues("microsoft/markitdown")

        self.assertEqual([12], [item["iid"] for item in issues])
        self.assertEqual("opened", issues[0]["state"])
        self.assertEqual(["bug"], issues[0]["labels"])
        self.assertEqual(
            {"count": 2, "completed_count": 1},
            issues[0]["task_completion_status"],
        )
        self.assertIsNone(issues[0]["due_date"])
        self.assertFalse(issues[0]["relation_counts_known"])

    def test_comments_are_normalized_as_single_note_discussions(self) -> None:
        self.provider._paginate = lambda *_args, **_kwargs: [  # type: ignore[method-assign]
            {
                "id": 101,
                "body": "hello",
                "user": {"id": 7, "login": "octocat", "avatar_url": "avatar"},
                "created_at": "2026-06-01T00:00:00Z",
                "updated_at": "2026-06-01T00:00:00Z",
            }
        ]

        discussions = self.provider.fetch_issue_discussions("microsoft/markitdown", 1)

        self.assertEqual("101", discussions[0]["id"])
        self.assertEqual("octocat", discussions[0]["notes"][0]["author_name"])
        self.assertEqual("hello", discussions[0]["notes"][0]["body"])

    def test_related_pull_requests_are_loaded_from_timeline_cross_references(
        self,
    ) -> None:
        self.provider._paginate = lambda *_args, **_kwargs: [  # type: ignore[method-assign]
            {
                "event": "cross-referenced",
                "source": {
                    "issue": {
                        "number": 2066,
                        "pull_request": {"url": "https://api.github.com/pulls/2066"},
                    }
                },
            }
        ]
        self.provider._request = lambda *_args, **_kwargs: response(  # type: ignore[method-assign]
            {
                "id": 99,
                "number": 2066,
                "title": "Fix CSV",
                "state": "open",
                "draft": False,
                "head": {"ref": "fix"},
                "base": {"ref": "main"},
                "user": {"login": "dev"},
            }
        )

        pulls = self.provider.fetch_issue_related_merge_requests(
            "microsoft/markitdown", 2019
        )

        self.assertEqual(2066, pulls[0]["iid"])
        self.assertEqual("pull_request", pulls[0]["kind"])
        self.assertIsNone(pulls[0]["head_pipeline_status"])

    def test_auth_and_not_found_errors_are_preserved(self) -> None:
        for status in (401, 404):
            with self.subTest(status=status):
                self.provider.session.request = Mock(  # type: ignore[method-assign]
                    return_value=response({"message": "error"}, status)
                )
                with self.assertRaises(requests.exceptions.HTTPError) as raised:
                    self.provider._request("GET", "/repos/owner/repo")
                self.assertEqual(status, raised.exception.response.status_code)

    def test_rate_limit_is_bounded_and_status_is_captured(self) -> None:
        limited = response({"message": "rate limit"}, 429)
        limited.headers.update(
            {
                "Retry-After": "1",
                "X-RateLimit-Limit": "60",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": "1780000000",
                "X-RateLimit-Resource": "core",
            }
        )
        self.provider.session.request = Mock(  # type: ignore[method-assign]
            return_value=limited
        )

        with (
            patch("backend.core.github_client.time.sleep") as sleep,
            self.assertRaises(requests.exceptions.HTTPError),
        ):
            self.provider._request("GET", "/repos/owner/repo")

        self.assertEqual(3, self.provider.session.request.call_count)
        self.assertEqual(2, sleep.call_count)
        self.assertEqual("0", self.provider.rate_limit_status["remaining"])

    def test_gitlab_normalizer_implements_shared_metadata(self) -> None:
        issue = GitLabIssueClient._normalize_issue(
            {"id": 1, "iid": 42, "title": "Example", "state": "opened"},
            "group/project",
        )

        self.assertEqual("gitlab", issue["provider"])
        self.assertEqual("group/project", issue["source_ref"])
        self.assertTrue(issue["relation_counts_known"])


if __name__ == "__main__":
    unittest.main()
