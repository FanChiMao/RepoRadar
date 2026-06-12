from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def http_error(status: int, text: str = "boom") -> requests.exceptions.HTTPError:
    response = Mock()
    response.status_code = status
    response.text = text
    return requests.exceptions.HTTPError(response=response)


class LoadIssueBundleTests(unittest.TestCase):
    def test_returns_issue_and_discussions(self) -> None:
        client = Mock()
        client.fetch_issue.return_value = {"iid": 7}
        client.fetch_issue_discussions.return_value = [{"id": "a"}]
        with (
            patch.object(
                api_app,
                "parse_issue_source_url",
                return_value=("github", "https://github.com", "owner/repo", 7),
            ),
            patch.object(api_app, "ensure_provider", return_value=client),
        ):
            issue, discussions = api_app.load_issue_bundle_from_url("url")
        self.assertEqual(7, issue["iid"])
        self.assertEqual([{"id": "a"}], discussions)

    def test_http_error_maps_to_status(self) -> None:
        client = Mock()
        client.fetch_issue.side_effect = http_error(404, "missing")
        with (
            patch.object(
                api_app,
                "parse_issue_source_url",
                return_value=("github", "https://github.com", "owner/repo", 7),
            ),
            patch.object(api_app, "ensure_provider", return_value=client),
        ):
            with self.assertRaises(HTTPException) as raised:
                api_app.load_issue_bundle_from_url("url")
        self.assertEqual(404, raised.exception.status_code)

    def test_generic_error_maps_to_502(self) -> None:
        client = Mock()
        client.fetch_issue.side_effect = RuntimeError("oops")
        with (
            patch.object(
                api_app,
                "parse_issue_source_url",
                return_value=("github", "https://github.com", "owner/repo", 7),
            ),
            patch.object(api_app, "ensure_provider", return_value=client),
        ):
            with self.assertRaises(HTTPException) as raised:
                api_app.load_issue_bundle_from_url("url")
        self.assertEqual(502, raised.exception.status_code)


class LoadIssueDetailBundleTests(unittest.TestCase):
    def test_tolerates_404_on_mrs_and_links(self) -> None:
        client = Mock()
        client.fetch_issue.return_value = {"iid": 7, "title": "T"}
        client.fetch_issue_discussions.return_value = []
        client.fetch_issue_related_merge_requests.side_effect = http_error(404)
        client.fetch_issue_links.side_effect = http_error(404)
        with (
            patch.object(
                api_app,
                "parse_issue_source_url",
                return_value=("github", "https://github.com", "owner/repo", 7),
            ),
            patch.object(api_app, "ensure_provider", return_value=client),
        ):
            bundle = api_app.load_issue_detail_bundle_from_url("url")
        self.assertEqual([], bundle["merge_requests"])
        self.assertEqual([], bundle["links"])
        self.assertEqual("owner/repo", bundle["project_ref"])


class ResolveFilterIssuesTests(unittest.TestCase):
    def test_merges_or_labels_and_sorts(self) -> None:
        client = Mock()
        client.fetch_issues_with_params.side_effect = [
            [{"iid": 1}],
            [{"iid": 2}, {"iid": 1}],
        ]
        with (
            patch.object(
                api_app,
                "parse_filter_source_url",
                return_value=(
                    "gitlab",
                    "https://g",
                    "g/p",
                    {"state": "opened"},
                    [],
                    ["a", "b"],
                    [],
                ),
            ),
            patch.object(api_app, "ensure_provider", return_value=client),
        ):
            issues = api_app.resolve_filter_issues("url")
        self.assertEqual([2, 1], [item["iid"] for item in issues])


class EnsureProviderTests(unittest.TestCase):
    def test_value_error_becomes_400(self) -> None:
        with (
            patch.object(api_app, "load_config", return_value={}),
            patch.object(
                api_app, "create_provider", side_effect=ValueError("bad config")
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                api_app.ensure_provider()
        self.assertEqual(400, raised.exception.status_code)


class FetchAndDashboardTests(unittest.TestCase):
    def test_post_fetch_success(self) -> None:
        with patch.object(
            api_app, "fetch_issues", return_value=[{"iid": 1}, {"iid": 2}]
        ):
            self.assertEqual({"count": 2}, api_app.post_fetch())

    def test_post_fetch_http_error(self) -> None:
        with patch.object(api_app, "fetch_issues", side_effect=http_error(403, "rl")):
            with self.assertRaises(HTTPException) as raised:
                api_app.post_fetch()
        self.assertEqual(403, raised.exception.status_code)

    def test_post_fetch_generic_error(self) -> None:
        with patch.object(api_app, "fetch_issues", side_effect=RuntimeError("x")):
            with self.assertRaises(HTTPException) as raised:
                api_app.post_fetch()
        self.assertEqual(400, raised.exception.status_code)

    def test_get_dashboard(self) -> None:
        with (
            patch.object(api_app, "read_issues", return_value=[{"iid": 1}]),
            patch.object(api_app, "load_meta", return_value={"last_sync": "now"}),
            patch.object(api_app, "build_dashboard", return_value={"summary": {}}),
        ):
            result = api_app.get_dashboard()
        self.assertEqual(1, result["issue_count"])
        self.assertEqual("now", result["last_sync"])

    def test_get_issues_simplifies(self) -> None:
        with patch.object(
            api_app, "read_issues", return_value=[{"iid": 1, "title": "T"}]
        ):
            issues = api_app.get_issues()
        self.assertEqual(1, len(issues))


class IssueRelationEndpointTests(unittest.TestCase):
    def test_discussions_returns_empty_for_import(self) -> None:
        with patch.object(
            api_app, "load_config", return_value={"import_file": "x.json"}
        ):
            self.assertEqual([], api_app.get_issue_discussions(1))

    def test_discussions_success(self) -> None:
        client = Mock()
        client.fetch_issue_discussions.return_value = [{"id": "a"}]
        with (
            patch.object(api_app, "load_config", return_value={}),
            patch.object(
                api_app, "active_provider_context", return_value=(client, "g/p")
            ),
        ):
            self.assertEqual([{"id": "a"}], api_app.get_issue_discussions(1))

    def test_merge_requests_404_returns_empty(self) -> None:
        client = Mock()
        client.fetch_issue_related_merge_requests.side_effect = http_error(404)
        with (
            patch.object(api_app, "load_config", return_value={}),
            patch.object(
                api_app, "active_provider_context", return_value=(client, "g/p")
            ),
        ):
            self.assertEqual([], api_app.get_issue_merge_requests(1))

    def test_links_http_error_propagates(self) -> None:
        client = Mock()
        client.fetch_issue_links.side_effect = http_error(500, "err")
        with (
            patch.object(api_app, "load_config", return_value={}),
            patch.object(
                api_app, "active_provider_context", return_value=(client, "g/p")
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                api_app.get_issue_links(1)
        self.assertEqual(500, raised.exception.status_code)

    def test_detail_by_url_requires_url(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            api_app.get_issue_detail_by_url(api_app.IssueUrlPayload(url="  "))
        self.assertEqual(400, raised.exception.status_code)


class ArrangeEndpointTests(unittest.TestCase):
    def test_preview_requires_urls(self) -> None:
        with self.assertRaises(HTTPException):
            api_app.preview_arrange_issues(api_app.ArrangePreviewPayload(urls=[" "]))

    def test_preview_collects_results_and_errors(self) -> None:
        def fake_bundle(url):
            if "bad" in url:
                raise HTTPException(status_code=404, detail="nope")
            return {"iid": 1, "title": "T", "assignees": [], "labels": []}, []

        with patch.object(
            api_app, "load_issue_bundle_from_url", side_effect=fake_bundle
        ):
            result = api_app.preview_arrange_issues(
                api_app.ArrangePreviewPayload(urls=["good", "bad"])
            )
        self.assertEqual(1, result["count"])
        self.assertEqual(1, len(result["errors"]))

    def test_resolve_filter_requires_filter_url(self) -> None:
        with self.assertRaises(HTTPException):
            api_app.resolve_arrange_filter(api_app.ArrangeFilterPayload(filter_url=" "))

    def test_resolve_filter_rejects_non_filter(self) -> None:
        with patch.object(api_app, "is_filter_url", return_value=False):
            with self.assertRaises(HTTPException):
                api_app.resolve_arrange_filter(
                    api_app.ArrangeFilterPayload(filter_url="https://x")
                )

    def test_resolve_filter_success(self) -> None:
        with (
            patch.object(api_app, "is_filter_url", return_value=True),
            patch.object(
                api_app,
                "resolve_filter_issues",
                return_value=[{"iid": 1, "title": "T"}],
            ),
            patch.object(
                api_app,
                "parse_filter_source_url",
                return_value=("gitlab", "https://g", "g/p", {}, [], [], []),
            ),
        ):
            result = api_app.resolve_arrange_filter(
                api_app.ArrangeFilterPayload(filter_url="https://g/p/-/issues?x=1")
            )
        self.assertEqual(1, result["count"])
        self.assertEqual("g/p", result["project_ref"])


class ArrangeHistoryEndpointTests(unittest.TestCase):
    def runtime_dir(self) -> Path:
        import shutil
        import uuid

        path = BACKEND_DIR / "data" / f"test-hist-{uuid.uuid4().hex}"
        path.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def test_history_file_invalid_name(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            api_app.get_arrange_history_file("../evil")
        self.assertEqual(400, raised.exception.status_code)

    def test_history_file_not_found(self) -> None:
        with patch.object(api_app, "ARRANGE_EXPORT_DIR", self.runtime_dir()):
            with self.assertRaises(HTTPException) as raised:
                api_app.get_arrange_history_file("missing.md")
        self.assertEqual(404, raised.exception.status_code)

    def test_history_file_reads_content(self) -> None:
        base = self.runtime_dir()
        result_dir = base / "result"
        result_dir.mkdir()
        (result_dir / "doc.md").write_text("hello", encoding="utf-8")
        with patch.object(api_app, "ARRANGE_EXPORT_DIR", base):
            payload = api_app.get_arrange_history_file("doc.md")
        self.assertEqual("hello", payload["content"])


class ReportEndpointTests(unittest.TestCase):
    def test_post_weekly_success(self) -> None:
        with patch.object(api_app, "generate_report", return_value=Path("/tmp/r.md")):
            result = api_app.post_weekly_report()
        self.assertIn("report_path", result)

    def test_post_weekly_error(self) -> None:
        with patch.object(api_app, "generate_report", side_effect=RuntimeError("x")):
            with self.assertRaises(HTTPException) as raised:
                api_app.post_weekly_report()
        self.assertEqual(400, raised.exception.status_code)

    def test_latest_report_none(self) -> None:
        with patch.object(api_app, "load_meta", return_value={}):
            self.assertEqual(
                {"report_path": None, "content": None}, api_app.get_latest_report()
            )

    def test_latest_report_missing_file(self) -> None:
        with patch.object(
            api_app, "load_meta", return_value={"latest_report_path": "nope.md"}
        ):
            result = api_app.get_latest_report()
        self.assertIsNone(result["content"])

    def test_report_html_renders(self) -> None:
        issues = [
            {
                "iid": 1,
                "state": "opened",
                "labels": ["bug"],
                "assignees": [],
                "milestone": None,
                "created_at": "2026-01-01T00:00:00Z",
                "closed_at": None,
                "due_date": None,
                "updated_at": "2026-01-01T00:00:00Z",
                "merge_requests_count": 0,
                "blocking_issues_count": 0,
                "relation_counts_known": True,
                "task_completion_status": {"count": 0, "completed_count": 0},
            }
        ]
        with (
            patch.object(api_app, "read_issues", return_value=issues),
            patch.object(api_app, "load_meta", return_value={}),
        ):
            result = api_app.get_report_html()
        self.assertIn("html", result)
        self.assertIsInstance(result["html"], str)


class ScheduledTaskTests(unittest.TestCase):
    def test_daily_sync_dispatch(self) -> None:
        with patch.object(api_app, "fetch_issues") as fetch:
            api_app.run_scheduled_task("daily_sync")
        fetch.assert_called_once()

    def test_weekly_report_dispatch(self) -> None:
        with patch.object(api_app, "generate_report") as gen:
            api_app.run_scheduled_task("weekly_report")
        gen.assert_called_once()

    def test_unknown_task_is_noop(self) -> None:
        with (
            patch.object(api_app, "fetch_issues") as fetch,
            patch.object(api_app, "generate_report") as gen,
        ):
            api_app.run_scheduled_task("nope")
        fetch.assert_not_called()
        gen.assert_not_called()


class BriefingEndpointTests(unittest.TestCase):
    def test_test_teams_success(self) -> None:
        with (
            patch.object(
                api_app,
                "load_briefing_settings",
                return_value={"teams_webhook_url": "u"},
            ),
            patch.object(
                api_app,
                "send_teams_webhook",
                return_value={"ok": True, "status_code": 200, "error": None},
            ),
            patch.object(api_app, "append_briefing_history"),
        ):
            result = api_app.post_briefing_test_teams()
        self.assertTrue(result["ok"])

    def test_test_teams_failure(self) -> None:
        with (
            patch.object(
                api_app,
                "load_briefing_settings",
                return_value={"teams_webhook_url": "u"},
            ),
            patch.object(
                api_app,
                "send_teams_webhook",
                return_value={"ok": False, "status_code": 500, "error": "down"},
            ),
            patch.object(api_app, "append_briefing_history"),
        ):
            result = api_app.post_briefing_test_teams()
        self.assertFalse(result["ok"])
        self.assertIn("down", result["message"])

    def test_get_history(self) -> None:
        with patch.object(api_app, "load_briefing_history", return_value=[{"a": 1}]):
            self.assertEqual({"items": [{"a": 1}]}, api_app.get_briefing_history())


if __name__ == "__main__":
    unittest.main()
