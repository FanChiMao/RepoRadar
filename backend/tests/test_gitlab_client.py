from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.gitlab_client import GitLabIssueClient  # noqa: E402


def response(payload: object, status: int = 200, headers: dict | None = None):
    value = requests.Response()
    value.status_code = status
    value._content = json.dumps(payload).encode("utf-8")
    value.headers["Content-Type"] = "application/json"
    for key, val in (headers or {}).items():
        value.headers[key] = val
    return value


class EncodeProjectRefTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = GitLabIssueClient("https://gitlab.example.com/", "token")

    def test_numeric_ref_is_passed_through(self) -> None:
        self.assertEqual("42", self.client._encode_project_ref("42"))

    def test_path_ref_is_url_encoded(self) -> None:
        self.assertEqual(
            "group%2Fsub%2Fproject",
            self.client._encode_project_ref("group/sub/project"),
        )

    def test_base_url_trailing_slash_is_trimmed(self) -> None:
        self.assertEqual("https://gitlab.example.com", self.client.base_url)


class FetchProjectIssuesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = GitLabIssueClient("https://gitlab.example.com", "token")

    def test_paginates_until_empty_batch(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            side_effect=[
                response([{"id": 1, "iid": 10, "title": "A", "state": "opened"}]),
                response([{"id": 2, "iid": 11, "title": "B", "state": "closed"}]),
                response([]),
            ]
        )

        issues = self.client.fetch_project_issues("group/project")

        self.assertEqual([10, 11], [item["iid"] for item in issues])
        self.assertEqual("group/project", issues[0]["source_ref"])
        self.assertEqual(3, self.client.session.get.call_count)
        # page increments across calls
        self.assertEqual(3, self.client.session.get.call_args.kwargs["params"]["page"])

    def test_requires_base_url_and_project_ref(self) -> None:
        with self.assertRaises(ValueError):
            self.client.fetch_project_issues("")
        empty = GitLabIssueClient("", "token")
        with self.assertRaises(ValueError):
            empty.fetch_project_issues("group/project")

    def test_http_error_is_raised(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "boom"}, 500)
        )
        with self.assertRaises(requests.exceptions.HTTPError):
            self.client.fetch_project_issues("group/project")


class FetchIssuesWithParamsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = GitLabIssueClient("https://gitlab.example.com", "token")

    def test_stops_when_batch_smaller_than_page_size(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response([{"id": 1, "iid": 5, "state": "opened"}])
        )

        results = self.client.fetch_issues_with_params(
            "group/project", {"labels": "bug"}
        )

        self.assertEqual([5], [item["iid"] for item in results])
        self.assertEqual(1, self.client.session.get.call_count)

    def test_requires_project_ref(self) -> None:
        with self.assertRaises(ValueError):
            self.client.fetch_issues_with_params("", {})


class FetchSingleResourceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = GitLabIssueClient("https://gitlab.example.com", "token")

    def test_fetch_issue_normalizes_payload(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response({"id": 1, "iid": 7, "title": "X", "state": "opened"})
        )
        issue = self.client.fetch_issue("group/project", 7)
        self.assertEqual(7, issue["iid"])
        self.assertEqual("gitlab", issue["provider"])
        self.assertTrue(issue["relation_counts_known"])

    def test_fetch_issue_requires_project_ref(self) -> None:
        with self.assertRaises(ValueError):
            self.client.fetch_issue("", 1)

    def test_fetch_discussions_filters_system_notes(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            side_effect=[
                response(
                    [
                        {
                            "id": "abc",
                            "notes": [
                                {
                                    "id": 1,
                                    "body": "real",
                                    "system": False,
                                    "author": {"name": "Dev", "username": "dev"},
                                },
                                {"id": 2, "body": "changed status", "system": True},
                            ],
                        }
                    ]
                ),
                response([]),
            ]
        )
        discussions = self.client.fetch_issue_discussions("group/project", 7)
        self.assertEqual("abc", discussions[0]["id"])
        self.assertEqual(1, len(discussions[0]["notes"]))
        self.assertEqual("Dev", discussions[0]["notes"][0]["author_name"])

    def test_fetch_related_merge_requests_normalizes(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response(
                [
                    {
                        "id": 9,
                        "iid": 3,
                        "title": "MR",
                        "state": "opened",
                        "work_in_progress": True,
                        "head_pipeline": {"status": "running"},
                        "author": {"name": "Dev", "username": "dev"},
                    }
                ]
            )
        )
        mrs = self.client.fetch_issue_related_merge_requests("group/project", 7)
        self.assertEqual(3, mrs[0]["iid"])
        self.assertEqual("merge_request", mrs[0]["kind"])
        self.assertTrue(mrs[0]["draft"])
        self.assertEqual("running", mrs[0]["head_pipeline_status"])

    def test_fetch_related_merge_requests_handles_non_list(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "unexpected"})
        )
        self.assertEqual(
            [], self.client.fetch_issue_related_merge_requests("group/project", 7)
        )

    def test_fetch_issue_links_normalizes_direction(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response(
                [
                    {
                        "id": 1,
                        "link_type": "blocks",
                        "source_issue": {"iid": 7, "title": "self"},
                        "target_issue": {"iid": 8, "title": "other"},
                    }
                ]
            )
        )
        links = self.client.fetch_issue_links("group/project", 7)
        self.assertEqual("outbound", links[0]["direction"])
        self.assertEqual(8, links[0]["issue"]["iid"])

    def test_fetch_issue_links_handles_non_list(self) -> None:
        self.client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response({"message": "nope"})
        )
        self.assertEqual([], self.client.fetch_issue_links("group/project", 7))


class TestConnectionTests(unittest.TestCase):
    def test_returns_metadata(self) -> None:
        client = GitLabIssueClient("https://gitlab.example.com", "token")
        client.session.get = Mock(  # type: ignore[method-assign]
            return_value=response(
                {
                    "path_with_namespace": "group/project",
                    "name": "Project",
                    "visibility": "private",
                    "default_branch": "main",
                },
                headers={"RateLimit-Remaining": "99"},
            )
        )
        result = client.test_connection("group/project")
        self.assertEqual("gitlab", result["provider"])
        self.assertEqual("group/project", result["source_ref"])
        self.assertTrue(result["private"])
        self.assertEqual("main", result["default_branch"])
        self.assertEqual("99", result["rate_limit_remaining"])


class CapabilitiesTests(unittest.TestCase):
    def test_reports_gitlab_capabilities(self) -> None:
        caps = GitLabIssueClient("https://gitlab.example.com", "t").capabilities()
        self.assertTrue(caps["discussion_threads"])
        self.assertEqual("merge_request", caps["related_change_kind"])
        self.assertFalse(caps["sub_issues"])


class IssueLinkNormalizationTests(unittest.TestCase):
    def test_inbound_direction(self) -> None:
        link = GitLabIssueClient._normalize_issue_link(
            7,
            {
                "id": 2,
                "link_type": "relates_to",
                "source_issue": {"iid": 5, "title": "from"},
                "target_issue": {"iid": 7, "title": "self"},
            },
        )
        self.assertEqual("inbound", link["direction"])
        self.assertEqual(5, link["issue"]["iid"])

    def test_flat_linked_issue_is_unknown_direction(self) -> None:
        link = GitLabIssueClient._normalize_issue_link(
            7, {"id": 3, "iid": 9, "title": "flat", "link_type": "blocks"}
        )
        self.assertEqual("unknown", link["direction"])
        self.assertEqual(9, link["issue"]["iid"])

    def test_unrelated_link_falls_back_to_target(self) -> None:
        link = GitLabIssueClient._normalize_issue_link(
            7,
            {
                "id": 4,
                "source_issue": {"iid": 1},
                "target_issue": {"iid": 2},
            },
        )
        self.assertEqual("unknown", link["direction"])
        self.assertEqual(2, link["issue"]["iid"])

    def test_linked_issue_ref_collects_assignees_and_milestone(self) -> None:
        ref = GitLabIssueClient._normalize_linked_issue_ref(
            {
                "iid": 1,
                "title": "T",
                "assignees": [{"name": "A"}, {"name": None}],
                "milestone": {"title": "M1", "due_date": "2026-01-01"},
            }
        )
        self.assertEqual(["A"], ref["assignees"])
        self.assertEqual("M1", ref["milestone"])
        self.assertEqual("2026-01-01", ref["due_date"])


class LoadLocalJsonTests(unittest.TestCase):
    def test_reads_list_payload(self) -> None:
        path = BACKEND_DIR / "data" / "test-gitlab-import.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps([{"iid": 1}]), encoding="utf-8")
        self.addCleanup(path.unlink, True)
        self.assertEqual([{"iid": 1}], GitLabIssueClient.load_local_json(str(path)))

    def test_missing_file_raises(self) -> None:
        with self.assertRaises(FileNotFoundError):
            GitLabIssueClient.load_local_json("does-not-exist.json")

    def test_non_list_payload_raises(self) -> None:
        path = BACKEND_DIR / "data" / "test-gitlab-bad.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"iid": 1}), encoding="utf-8")
        self.addCleanup(path.unlink, True)
        with self.assertRaises(ValueError):
            GitLabIssueClient.load_local_json(str(path))


if __name__ == "__main__":
    unittest.main()
