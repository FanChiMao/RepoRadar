from __future__ import annotations

import sys
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import Mock

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.scheduler import TrackerScheduler  # noqa: E402


def _make_scheduler(**overrides):
    meta: dict = {}
    defaults = {
        "config_provider": Mock(return_value={}),
        "task_runner": Mock(),
        "meta_provider": Mock(return_value=meta),
        "meta_saver": Mock(),
    }
    defaults.update(overrides)
    scheduler = TrackerScheduler(**defaults)
    return scheduler, meta


class ShouldRunTests(unittest.TestCase):
    def test_false_when_time_does_not_match(self) -> None:
        scheduler, _ = _make_scheduler()
        now = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
        self.assertFalse(scheduler._should_run(now, "daily_sync", "10:00"))

    def test_true_and_records_run_on_first_match(self) -> None:
        meta_saver = Mock()
        scheduler, meta = _make_scheduler(meta_saver=meta_saver)
        now = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
        self.assertTrue(scheduler._should_run(now, "daily_sync", "09:00"))
        self.assertEqual("2026-06-10", meta["scheduler"]["daily_sync"])
        meta_saver.assert_called_once_with(meta)

    def test_false_when_already_ran_today(self) -> None:
        meta = {"scheduler": {"daily_sync": "2026-06-10"}}
        scheduler, _ = _make_scheduler(meta_provider=Mock(return_value=meta))
        now = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
        self.assertFalse(scheduler._should_run(now, "daily_sync", "09:00"))


class CheckBriefingTests(unittest.TestCase):
    def test_noop_without_briefing_callbacks(self) -> None:
        scheduler, _ = _make_scheduler()
        scheduler._check_briefing()  # should not raise

    def test_skips_when_disabled(self) -> None:
        runner = Mock()
        scheduler, _ = _make_scheduler(
            briefing_provider=Mock(return_value={"enabled": False}),
            briefing_runner=runner,
        )
        scheduler._check_briefing()
        runner.assert_not_called()

    def test_skips_when_not_a_workday(self) -> None:
        runner = Mock()
        # 2026-06-10 is a Wednesday (isoweekday 3); allow only weekends.
        settings = {
            "enabled": True,
            "teams_webhook_url": "https://hook",
            "timezone": "UTC",
            "workdays": [6, 7],
            "send_time": "18:30",
        }
        scheduler, _ = _make_scheduler(
            briefing_provider=Mock(return_value=settings),
            briefing_runner=runner,
        )
        scheduler._check_briefing()
        runner.assert_not_called()


class CheckPulseTests(unittest.TestCase):
    def test_noop_without_pulse_callbacks(self) -> None:
        scheduler, _ = _make_scheduler()
        scheduler._check_pulse()  # should not raise

    def test_skips_schedule_without_id(self) -> None:
        runner = Mock()
        schedule = {
            "enabled": True,
            "teams_webhook_url": "https://hook",
            "workdays": [1, 2, 3, 4, 5, 6, 7],
        }
        scheduler, _ = _make_scheduler(
            pulse_provider=Mock(return_value=[schedule]),
            pulse_runner=runner,
        )
        scheduler._check_pulse()
        runner.assert_not_called()

    def test_skips_disabled_schedule(self) -> None:
        runner = Mock()
        scheduler, _ = _make_scheduler(
            pulse_provider=Mock(return_value=[{"enabled": False, "id": "s1"}]),
            pulse_runner=runner,
        )
        scheduler._check_pulse()
        runner.assert_not_called()


class StartStopTests(unittest.TestCase):
    def test_start_is_idempotent_and_stop_joins(self) -> None:
        scheduler, _ = _make_scheduler()
        scheduler.start()
        first_thread = scheduler._thread
        scheduler.start()  # second start must not spawn a new thread
        self.assertIs(first_thread, scheduler._thread)
        scheduler.stop()
        self.assertTrue(scheduler._stop_event.is_set())


if __name__ == "__main__":
    unittest.main()
