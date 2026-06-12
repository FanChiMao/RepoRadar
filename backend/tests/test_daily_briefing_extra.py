from __future__ import annotations

import unittest
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import requests

from backend.core import daily_briefing_service as briefing


class SendTeamsWebhookErrorTests(unittest.TestCase):
    def test_timeout(self) -> None:
        with patch.object(
            briefing.requests, "post", side_effect=requests.exceptions.Timeout()
        ):
            result = briefing.send_teams_webhook("https://hook", "t", "m")
        self.assertFalse(result["ok"])
        self.assertIn("逾時", result["error"])

    def test_http_error(self) -> None:
        resp = Mock()
        resp.status_code = 500
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        with patch.object(briefing.requests, "post", return_value=resp):
            result = briefing.send_teams_webhook("https://secret.example/tok", "t", "m")
        self.assertFalse(result["ok"])
        self.assertEqual(500, result["status_code"])
        # the webhook URL must never leak into the error string
        self.assertNotIn("secret.example", result["error"])

    def test_connection_error(self) -> None:
        with patch.object(
            briefing.requests,
            "post",
            side_effect=requests.exceptions.ConnectionError(),
        ):
            result = briefing.send_teams_webhook("https://hook", "t", "m")
        self.assertFalse(result["ok"])
        self.assertIn("無法連線", result["error"])

    def test_success(self) -> None:
        resp = Mock()
        resp.status_code = 200
        resp.raise_for_status.return_value = None
        with patch.object(briefing.requests, "post", return_value=resp):
            result = briefing.send_teams_webhook(
                "https://hook", "t", "see http://x.com"
            )
        self.assertTrue(result["ok"])


class TimezoneHelperTests(unittest.TestCase):
    def test_today_str_returns_iso_date(self) -> None:
        value = briefing.today_str("Asia/Taipei")
        datetime.strptime(value, "%Y-%m-%d")  # parses without error

    def test_day_bounds_for_past_date_uses_end_of_day(self) -> None:
        start, end = briefing._day_bounds_utc("2020-01-01", "Asia/Taipei")
        self.assertLess(start, end)
        self.assertEqual(UTC, start.tzinfo)

    def test_safe_zone_falls_back_for_unknown(self) -> None:
        zone = briefing._safe_zone("Not/AZone")
        self.assertIsNotNone(zone)


class GetTodayUpdatedTests(unittest.TestCase):
    def test_naive_datetime_treated_as_utc(self) -> None:
        today = datetime.now(UTC).date().isoformat()
        issues = [{"iid": 1, "updated_at": f"{today}T12:00:00"}]
        # naive timestamp at noon should still fall within today's window
        with patch.object(
            briefing,
            "_day_bounds_utc",
            return_value=(
                datetime(2000, 1, 1, tzinfo=UTC),
                datetime(2100, 1, 1, tzinfo=UTC),
            ),
        ):
            selected = briefing.get_today_updated_issues(issues, today, "UTC")
        self.assertEqual(1, len(selected))


class GenerateBriefingFullTests(unittest.TestCase):
    def _issue(self) -> dict:
        now = datetime.now(UTC).isoformat()
        return {
            "iid": 1,
            "title": "Login broken",
            "state": "opened",
            "web_url": "https://git/issues/1",
            "updated_at": now,
            "labels": ["bug"],
            "assignees": [],
            "milestone": None,
            "created_at": now,
            "closed_at": None,
            "due_date": None,
        }

    def test_rule_based_message_when_no_llm(self) -> None:
        chunks = [
            {"source_type": "overview", "text": "summary"},
            {"source_type": "discussion", "text": "failed to deploy"},
        ]
        with (
            patch.object(
                briefing,
                "load_rag_index",
                return_value={
                    "chunks": [{"issue_iid": 1}],
                    "built_at": "2026-06-01T00:00:00Z",
                },
            ),
            patch.object(briefing, "collect_issue_context", return_value=chunks),
        ):
            result = briefing.generate_daily_briefing(
                settings={"timezone": "UTC", "include_source_links": True},
                issues=[self._issue()],
            )
        self.assertEqual(1, result["issue_count"])
        self.assertEqual("indexed", result["mode"])
        self.assertIn(briefing.BRIEFING_TITLE, result["message"])
        self.assertIn("#1", result["message"])

    def test_llm_message_replaces_rule_based(self) -> None:
        with (
            patch.object(
                briefing,
                "load_rag_index",
                return_value={"chunks": [{"issue_iid": 1}], "built_at": None},
            ),
            patch.object(briefing, "collect_issue_context", return_value=[]),
        ):
            result = briefing.generate_daily_briefing(
                settings={"timezone": "UTC"},
                issues=[self._issue()],
                llm_caller=lambda **kwargs: ("LLM briefing text", "model-x"),
            )
        self.assertEqual("LLM briefing text", result["message"])

    def test_llm_failure_falls_back(self) -> None:
        def boom(**kwargs):
            raise RuntimeError("llm down")

        with patch.object(
            briefing,
            "load_rag_index",
            return_value={"chunks": [], "built_at": None},
        ):
            result = briefing.generate_daily_briefing(
                settings={"timezone": "UTC"},
                issues=[self._issue()],
                llm_caller=boom,
            )
        # falls back to the deterministic message
        self.assertIn(briefing.BRIEFING_TITLE, result["message"])
        self.assertEqual("cache", result["mode"])


if __name__ == "__main__":
    unittest.main()
