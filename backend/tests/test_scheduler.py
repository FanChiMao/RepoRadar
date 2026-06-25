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


class DispatchTests(unittest.TestCase):
    def test_synchronous_submit_runs_inline(self) -> None:
        scheduler, _ = _make_scheduler(synchronous=True)
        runner = Mock()
        scheduler._submit(runner, "x")
        runner.assert_called_once_with("x")

    def test_submit_swallows_errors(self) -> None:
        scheduler, _ = _make_scheduler(synchronous=True)
        scheduler._submit(Mock(side_effect=RuntimeError("boom")), "x")  # no raise

    def test_async_submit_queues_without_running(self) -> None:
        scheduler, _ = _make_scheduler()
        runner = Mock()
        scheduler._submit(runner, "x")
        runner.assert_not_called()
        self.assertEqual(1, scheduler._work_queue.qsize())

    def test_all_same_time_schedules_dispatch(self) -> None:
        # The race fix: when two schedules share a send time, both must be
        # dispatched in the same pass — not just the first.
        runner = Mock()
        all_days = [1, 2, 3, 4, 5, 6, 7]
        schedules = [
            {
                "enabled": True,
                "teams_webhook_url": "https://h",
                "id": "s1",
                "workdays": all_days,
            },
            {
                "enabled": True,
                "teams_webhook_url": "https://h",
                "id": "s2",
                "workdays": all_days,
            },
        ]
        scheduler, _ = _make_scheduler(
            pulse_provider=Mock(return_value=schedules),
            pulse_runner=runner,
            synchronous=True,
        )
        scheduler._should_run = Mock(return_value=True)  # treat both as due
        scheduler._check_pulse()
        self.assertEqual([(("s1",), {}), (("s2",), {})], runner.call_args_list)


class TickTests(unittest.TestCase):
    def test_tick_once_evaluates_pulse(self) -> None:
        runner = Mock()
        scheduler, _ = _make_scheduler(
            pulse_provider=Mock(return_value=[]),
            pulse_runner=runner,
            synchronous=True,
        )
        scheduler.tick_once()  # should not raise with empty schedule set


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
