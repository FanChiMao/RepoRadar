from __future__ import annotations

import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402


def _iso(days_from_now: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days_from_now)).strftime("%Y-%m-%d")


def _issue(**overrides):
    base = {
        "iid": 1,
        "title": "Issue",
        "description": "",
        "state": "opened",
        "labels": [],
        "assignees": [],
        "milestone": None,
        "due_date": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "closed_at": None,
        "merge_requests_count": 0,
        "blocking_issues_count": 0,
        "relation_counts_known": True,
        "task_completion_status": {"count": 0, "completed_count": 0},
    }
    base.update(overrides)
    return base


class DeliveryInsightsTests(unittest.TestCase):
    def test_counts_mr_checklist_and_blocked(self) -> None:
        issues = [
            _issue(iid=1, merge_requests_count=1),
            _issue(iid=2, merge_requests_count=0),
            _issue(
                iid=3,
                task_completion_status={"count": 2, "completed_count": 2},
                merge_requests_count=0,
            ),
            _issue(iid=4, blocking_issues_count=1),
            _issue(iid=5, state="closed"),
        ]
        result = api_app._compute_delivery_insights(issues)
        self.assertEqual(4, result["open_total"])
        self.assertEqual(1, result["linked_mr_count"])
        self.assertEqual(3, result["without_mr_count"])
        self.assertEqual(1, result["checklist_count"])
        self.assertEqual(1, result["checklist_done_count"])
        self.assertEqual(1, result["blocked_count"])

    def test_followups_flag_due_soon_without_mr(self) -> None:
        issues = [_issue(iid=9, due_date=_iso(3), merge_requests_count=0)]
        result = api_app._compute_delivery_insights(issues)
        self.assertTrue(result["followups"])
        self.assertIn("Due soon", result["followups"][0]["note"])

    def test_stale_without_mr_counted(self) -> None:
        old = (datetime.now(UTC) - timedelta(days=20)).strftime(
            "%Y-%m-%dT%H:%M:%S+00:00"
        )
        issues = [_issue(iid=10, merge_requests_count=0, updated_at=old)]
        result = api_app._compute_delivery_insights(issues)
        self.assertEqual(1, result["stale_without_mr_count"])


class LabelDistributionTests(unittest.TestCase):
    def test_counts_all_and_open(self) -> None:
        issues = [
            _issue(iid=1, labels=["bug", "ui"], state="opened"),
            _issue(iid=2, labels=["bug"], state="closed"),
        ]
        dist = api_app._compute_label_distribution(issues)
        by_label = {row["label"]: row for row in dist}
        self.assertEqual(2, by_label["bug"]["total"])
        self.assertEqual(1, by_label["bug"]["open"])
        self.assertEqual(1, by_label["ui"]["total"])


class LifecycleTests(unittest.TestCase):
    def test_empty_when_no_closed_issues(self) -> None:
        result = api_app._compute_lifecycle([_issue(state="opened")])
        self.assertIsNone(result["mttr_days"])
        self.assertEqual(0, result["total_closed"])

    def test_computes_mttr_and_histogram(self) -> None:
        issues = [
            _issue(
                iid=1,
                state="closed",
                created_at="2026-01-01T00:00:00Z",
                closed_at="2026-01-03T00:00:00Z",
            ),
            _issue(
                iid=2,
                state="closed",
                created_at="2026-01-01T00:00:00Z",
                closed_at="2026-01-11T00:00:00Z",
            ),
        ]
        result = api_app._compute_lifecycle(issues)
        self.assertEqual(2, result["total_closed"])
        self.assertIsNotNone(result["mttr_days"])
        self.assertTrue(any(b["count"] for b in result["histogram"]))
        self.assertTrue(result["throughput"])


class GetAnalyticsTests(unittest.TestCase):
    def test_aggregates_all_sections(self) -> None:
        issues = [
            _issue(
                iid=1,
                state="opened",
                milestone={
                    "title": "v1",
                    "start_date": "2026-01-01",
                    "due_date": _iso(5),
                },
                assignees=[{"name": "Alice", "avatar_url": "a.png"}],
                due_date=_iso(2),
                labels=["bug"],
            ),
            _issue(
                iid=2,
                state="closed",
                created_at="2026-01-01T00:00:00Z",
                closed_at="2026-01-05T00:00:00Z",
                milestone={"title": "v1", "due_date": _iso(5)},
            ),
            _issue(iid=3, state="opened", due_date=_iso(-1)),
        ]
        with patch.object(api_app, "read_issues", return_value=issues):
            result = api_app.get_analytics()

        self.assertIn("burndown", result)
        self.assertIn("workload", result)
        self.assertTrue(result["burndown"])
        self.assertTrue(result["workload"])
        # one overdue + one due-soon alert expected
        severities = {alert["severity"] for alert in result["alerts"]}
        self.assertIn("overdue", severities)
        self.assertIn("delivery", result)
        self.assertIn("label_distribution", result)
        self.assertIn("lifecycle", result)

    def test_handles_empty_cache(self) -> None:
        with patch.object(api_app, "read_issues", return_value=[]):
            result = api_app.get_analytics()
        self.assertEqual([], result["burndown"])
        self.assertEqual([], result["alerts"])


if __name__ == "__main__":
    unittest.main()
