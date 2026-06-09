from __future__ import annotations

import shutil
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from backend.core import config_store
from backend.core import daily_briefing_service as briefing


class BriefingPathMixin(unittest.TestCase):
    def runtime_dir(self) -> Path:
        path = Path(__file__).resolve().parents[1] / "data" / f"test-{uuid.uuid4().hex}"
        path.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def patched_paths(self) -> Path:
        directory = self.runtime_dir()
        self.addCleanup(
            patch.object(
                config_store, "DAILY_BRIEFING_PATH", directory / "daily_briefing.json"
            ).stop
        )
        self.addCleanup(
            patch.object(
                config_store,
                "DAILY_BRIEFING_HISTORY_PATH",
                directory / "daily_briefing_history.json",
            ).stop
        )
        patch.object(
            config_store, "DAILY_BRIEFING_PATH", directory / "daily_briefing.json"
        ).start()
        patch.object(
            config_store,
            "DAILY_BRIEFING_HISTORY_PATH",
            directory / "daily_briefing_history.json",
        ).start()
        return directory


class MaskAndSenderTests(BriefingPathMixin):
    def test_mask_webhook_url(self) -> None:
        self.assertEqual("", briefing.mask_webhook_url(""))
        self.assertEqual("", briefing.mask_webhook_url(None))
        url = (
            "https://default301f0000.environment.api.powerplatform.com/"
            "workflows/abc/triggers/manual/run?sig=SUPER_SECRET_TOKEN_VALUE"
        )
        masked = briefing.mask_webhook_url(url)
        self.assertTrue(masked.startswith(url[:32]))
        self.assertTrue(masked.endswith("...sig=********"))
        self.assertNotIn("SUPER_SECRET_TOKEN_VALUE", masked)

    def test_send_teams_no_url(self) -> None:
        result = briefing.send_teams_webhook("", "t", "m")
        self.assertFalse(result["ok"])
        self.assertNotIn("http", (result["error"] or ""))


class SettingsTests(BriefingPathMixin):
    def test_save_preserves_webhook_when_empty_and_clears_on_flag(self) -> None:
        self.patched_paths()
        config_store.save_briefing_settings(
            {"enabled": True, "teams_webhook_url": "https://example.com/hook?sig=xyz"}
        )
        # Empty incoming url must NOT wipe the stored one.
        kept = config_store.save_briefing_settings(
            {"enabled": True, "teams_webhook_url": ""}
        )
        self.assertEqual("https://example.com/hook?sig=xyz", kept["teams_webhook_url"])
        # Explicit clear flag wipes it.
        cleared = config_store.save_briefing_settings(
            {"enabled": True, "clear_teams_webhook_url": True}
        )
        self.assertEqual("", cleared["teams_webhook_url"])

    def test_public_settings_masks(self) -> None:
        self.patched_paths()
        config_store.save_briefing_settings(
            {"teams_webhook_url": "https://example.com/hook?sig=topsecret"}
        )
        public = config_store.public_briefing_settings()
        self.assertNotIn("teams_webhook_url", public)
        self.assertTrue(public["has_teams_webhook_url"])
        self.assertTrue(public["teams_webhook_url_masked"])
        self.assertNotIn("topsecret", str(public))

    def test_normalize_workdays_and_send_time(self) -> None:
        self.patched_paths()
        saved = config_store.save_briefing_settings(
            {"workdays": [3, 1, 9, 1, "2"], "send_time": "9:5"}
        )
        self.assertEqual([1, 2, 3], saved["workdays"])
        self.assertEqual("09:05", saved["send_time"])


class HistoryTests(BriefingPathMixin):
    def test_history_append_caps_20_newest_first_no_url(self) -> None:
        self.patched_paths()
        for i in range(25):
            config_store.append_briefing_history(
                {"at": str(i), "date": "2026-06-08", "ok": True}
            )
        history = config_store.load_briefing_history()
        self.assertEqual(20, len(history))
        self.assertEqual("24", history[0]["at"])  # newest first
        for entry in history:
            self.assertNotIn("teams_webhook_url", entry)
            self.assertNotIn("webhook", entry)


class FilteringTests(BriefingPathMixin):
    def test_today_updated_filtering(self) -> None:
        # Past date → full local day window in Asia/Taipei (UTC+8).
        issues = [
            {"iid": 1, "updated_at": "2026-06-01T10:00:00+08:00"},  # in
            {"iid": 2, "updated_at": "2026-06-01T00:30:00+08:00"},  # in (early)
            {"iid": 3, "updated_at": "2026-06-01T05:00:00Z"},  # in (=13:00+08)
            {"iid": 4, "updated_at": "2026-05-31T23:00:00+08:00"},  # out (prev day)
            {"iid": 5, "updated_at": "2026-06-02T01:00:00+08:00"},  # out (next day)
            {"iid": 6, "updated_at": None},  # out (no timestamp)
        ]
        selected = briefing.get_today_updated_issues(
            issues, "2026-06-01", "Asia/Taipei"
        )
        self.assertEqual({1, 2, 3}, {issue["iid"] for issue in selected})


class ClassificationTests(BriefingPathMixin):
    def test_classify_issue(self) -> None:
        risk_pipeline = [
            {
                "source_type": "related_change",
                "text": "ok",
                "metadata": {"pipeline_status": "failed"},
            }
        ]
        self.assertEqual(
            briefing.CATEGORY_RISK,
            briefing.classify_issue({"state": "opened"}, risk_pipeline, True),
        )

        risk_kw = [
            {"source_type": "discussion", "text": "build failed again", "metadata": {}}
        ]
        self.assertEqual(
            briefing.CATEGORY_RISK,
            briefing.classify_issue({"state": "opened"}, risk_kw, True),
        )

        progress_closed = [
            {"source_type": "overview", "text": "all good", "metadata": {}}
        ]
        self.assertEqual(
            briefing.CATEGORY_PROGRESS,
            briefing.classify_issue({"state": "closed"}, progress_closed, True),
        )

        progress_kw = [
            {"source_type": "discussion", "text": "MR merged", "metadata": {}}
        ]
        self.assertEqual(
            briefing.CATEGORY_PROGRESS,
            briefing.classify_issue({"state": "opened"}, progress_kw, True),
        )

        track = [
            {
                "source_type": "discussion",
                "text": "still discussing the plan",
                "metadata": {},
            }
        ]
        self.assertEqual(
            briefing.CATEGORY_TRACK,
            briefing.classify_issue({"state": "opened"}, track, True),
        )

        info = [
            {"source_type": "overview", "text": "minor label tweak", "metadata": {}}
        ]
        self.assertEqual(
            briefing.CATEGORY_INFO,
            briefing.classify_issue({"state": "opened"}, info, True),
        )


class GenerateTests(BriefingPathMixin):
    def test_empty_day_briefing(self) -> None:
        self.patched_paths()
        result = briefing.generate_daily_briefing(
            "2026-06-01",
            settings=config_store.load_briefing_settings(),
            issues=[],
            llm_caller=None,
        )
        self.assertTrue(result["ok"])
        self.assertEqual(0, result["issue_count"])
        self.assertEqual(briefing.BRIEFING_TITLE, result["title"])
        self.assertIn("沒有", result["message"])


if __name__ == "__main__":
    unittest.main()
