from __future__ import annotations

import threading
import time
from datetime import UTC, datetime
from typing import Callable


class TrackerScheduler:
    def __init__(
        self,
        config_provider: Callable[[], dict],
        task_runner: Callable[[str], None],
        meta_provider: Callable[[], dict],
        meta_saver: Callable[[dict], None],
        briefing_provider: Callable[[], dict] | None = None,
        briefing_runner: Callable[[], None] | None = None,
        pulse_provider: Callable[[], list[dict]] | None = None,
        pulse_runner: Callable[[str], None] | None = None,
    ) -> None:
        self._config_provider = config_provider
        self._task_runner = task_runner
        self._meta_provider = meta_provider
        self._meta_saver = meta_saver
        self._briefing_provider = briefing_provider
        self._briefing_runner = briefing_runner
        self._pulse_provider = pulse_provider
        self._pulse_runner = pulse_runner
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def _should_run(self, now: datetime, task_name: str, target_time: str) -> bool:
        hour, minute = (int(part) for part in target_time.split(":"))
        if now.hour != hour or now.minute != minute:
            return False

        meta = self._meta_provider()
        scheduler_meta = meta.setdefault("scheduler", {})
        last_run = scheduler_meta.get(task_name)
        today = now.date().isoformat()
        if last_run == today:
            return False
        scheduler_meta[task_name] = today
        self._meta_saver(meta)
        return True

    def _check_briefing(self) -> None:
        """Timezone-aware daily briefing trigger. Kept separate from the
        local-time daily/weekly checks because the briefing time + workdays are
        evaluated in the user's configured timezone, and dedupe is keyed by the
        local date there."""
        if not (self._briefing_provider and self._briefing_runner):
            return
        settings = self._briefing_provider()
        if not (settings.get("enabled") and settings.get("teams_webhook_url")):
            return

        # Local import avoids a hard dependency at module import time.
        from .daily_briefing_service import _safe_zone

        tz = _safe_zone(settings.get("timezone", "Asia/Taipei"))
        local = datetime.now(UTC).astimezone(tz)
        if local.isoweekday() not in (settings.get("workdays") or []):
            return
        if self._should_run(
            local, "daily_briefing", settings.get("send_time", "18:30")
        ):
            self._briefing_runner()

    def _check_pulse(self) -> None:
        """Multi-schedule Project Pulse trigger. Each schedule is evaluated in
        its own timezone; dedupe is keyed per schedule + local date so the same
        schedule auto-sends at most once a day (Send Now bypasses this)."""
        if not (self._pulse_provider and self._pulse_runner):
            return

        from .daily_briefing_service import _safe_zone

        for schedule in self._pulse_provider():
            if not (schedule.get("enabled") and schedule.get("teams_webhook_url")):
                continue
            schedule_id = schedule.get("id")
            if not schedule_id:
                continue
            tz = _safe_zone(schedule.get("timezone", "Asia/Taipei"))
            local = datetime.now(UTC).astimezone(tz)
            if local.isoweekday() not in (schedule.get("workdays") or []):
                continue
            if self._should_run(
                local, f"pulse:{schedule_id}", schedule.get("send_time", "18:30")
            ):
                self._pulse_runner(schedule_id)

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            now = datetime.now(UTC).astimezone()
            config = self._config_provider()
            try:
                if config.get("enable_daily_sync") and self._should_run(
                    now, "daily_sync", config.get("daily_sync_time", "09:00")
                ):
                    self._task_runner("daily_sync")
                if (
                    now.weekday() == 4
                    and config.get("enable_weekly_report")
                    and self._should_run(
                        now, "weekly_report", config.get("weekly_report_time", "17:30")
                    )
                ):
                    self._task_runner("weekly_report")
                self._check_briefing()
                self._check_pulse()
            except Exception as exc:
                print(f"[scheduler] error: {exc}")
            time.sleep(30)
