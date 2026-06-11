from __future__ import annotations

import shutil
import sys
import unittest
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import report_service  # noqa: E402

NOW = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


class ExtractModuleTests(unittest.TestCase):
    def test_reads_page_label(self) -> None:
        issue = {"labels": ["【Page】Dashboard", "bug"]}
        self.assertEqual("Dashboard", report_service.extract_module(issue))

    def test_falls_back_to_bracket_title(self) -> None:
        issue = {"labels": [], "title": "[Login] cannot submit"}
        self.assertEqual("Login", report_service.extract_module(issue))

    def test_returns_none_without_marker(self) -> None:
        self.assertIsNone(report_service.extract_module({"title": "plain title"}))


class SimplifyIssueTests(unittest.TestCase):
    def test_flattens_nested_fields(self) -> None:
        issue = {
            "iid": 7,
            "title": "[Auth] bug",
            "state": "opened",
            "assignees": [
                {"name": "Amy", "username": "amy", "avatar_url": "u"},
                {"username": "no-name"},
            ],
            "milestone": {"title": "M1", "due_date": "2026-07-01"},
            "task_completion_status": {"count": 4, "completed_count": 1},
        }
        result = report_service.simplify_issue(issue, note="n", reason="r")
        self.assertEqual(7, result["iid"])
        self.assertEqual("Auth", result["module"])
        self.assertEqual(["Amy"], result["assignees"])
        self.assertEqual("M1", result["milestone"])
        self.assertEqual("2026-07-01", result["due_date"])
        self.assertEqual(4, result["task_total"])
        self.assertEqual(1, result["task_completed"])
        self.assertEqual("n", result["note"])
        self.assertEqual("r", result["reason"])

    def test_defaults_provider_to_gitlab(self) -> None:
        self.assertEqual("gitlab", report_service.simplify_issue({})["provider"])


class BuildDashboardTests(unittest.TestCase):
    def test_summary_counts_and_risks(self) -> None:
        issues = [
            {  # fresh, assigned, open -> weekly_new + weekly_updated
                "iid": 1,
                "title": "new one",
                "state": "opened",
                "created_at": _iso(1),
                "updated_at": _iso(1),
                "assignees": [{"name": "Amy"}],
                "description": "ctx",
                "issue_type": "issue",
                "labels": ["a", "b"],
            },
            {  # open, unassigned, stale -> risk (unassigned + stale)
                "iid": 2,
                "title": "stale",
                "state": "opened",
                "created_at": _iso(40),
                "updated_at": _iso(30),
                "assignees": [],
            },
            {  # closed this week
                "iid": 3,
                "title": "done",
                "state": "closed",
                "created_at": _iso(20),
                "updated_at": _iso(2),
                "closed_at": _iso(2),
                "assignees": [{"name": "Bob"}],
            },
        ]
        dash = report_service.build_dashboard(issues, now=NOW)
        summary = dash["summary"]
        self.assertEqual(1, summary["weekly_new_count"])
        self.assertEqual(1, summary["weekly_closed_count"])
        self.assertEqual(2, summary["open_issue_count"])
        self.assertEqual(1, summary["unassigned_count"])
        self.assertGreaterEqual(summary["risk_count"], 1)
        # issue #2 is unassigned -> appears in risks with that reason
        risk_iids = {item["iid"] for item in dash["risks"]}
        self.assertIn(2, risk_iids)

    def test_near_due_risk_reason(self) -> None:
        issues = [
            {
                "iid": 9,
                "title": "due soon",
                "state": "opened",
                "updated_at": _iso(1),
                "assignees": [{"name": "Amy"}],
                "due_date": (NOW + timedelta(days=3)).date().isoformat(),
            }
        ]
        dash = report_service.build_dashboard(issues, now=NOW)
        self.assertEqual(1, dash["summary"]["near_due_count"])
        self.assertIn("7 天內到期", dash["risks"][0]["reason"])


class MarkdownAndPathTests(unittest.TestCase):
    def _tmp_dir(self) -> Path:
        base = BACKEND_DIR / "data" / f"test-report-{uuid.uuid4().hex}"
        base.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, base, True)
        return base

    def test_generate_weekly_markdown_writes_sections(self) -> None:
        issues = [
            {
                "iid": 1,
                "title": "new one",
                "state": "opened",
                "created_at": _iso(1),
                "updated_at": _iso(1),
                "assignees": [{"name": "Amy"}],
                "description": "ctx",
                "issue_type": "issue",
            }
        ]
        dash = report_service.build_dashboard(issues, now=NOW)
        target = self._tmp_dir() / "weekly.md"
        result = report_service.generate_weekly_markdown(dash, target, generated_at=NOW)
        self.assertEqual(target, result)
        text = target.read_text(encoding="utf-8")
        self.assertIn("# Repo Radar 週報", text)
        self.assertIn("## 1. 週摘要", text)
        self.assertIn("#1", text)

    def test_weekly_report_path_uses_timestamp(self) -> None:
        path = report_service.weekly_report_path(now=NOW)
        self.assertEqual("weekly_report_20260610_120000.md", path.name)


if __name__ == "__main__":
    unittest.main()
