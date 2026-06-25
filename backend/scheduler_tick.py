"""Headless one-shot scheduler tick.

Runs a single evaluation pass over every AI schedule (plus the daily briefing /
sync / weekly tasks) and exits. Registered with the Windows Task Scheduler by
``core.os_scheduler`` so reports still fire when the RepoRadar app is closed.

``--data-dir`` pins the run to the same data directory the app uses; it MUST be
applied to the environment before ``app`` (and therefore ``config_store``, which
resolves its paths at import time) is imported.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RepoRadar headless scheduler tick")
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Data directory to read schedules/config from (REPO_RADAR_DATA_DIR).",
    )
    return parser.parse_args(argv)


def _ensure_streams() -> None:
    """Under ``pythonw.exe`` (used so the scheduled task is windowless),
    ``sys.stdout``/``sys.stderr`` are ``None`` and any ``print`` in the tick path
    would raise. Point them at the null device so logging is a harmless no-op."""
    for name in ("stdout", "stderr"):
        if getattr(sys, name, None) is None:
            setattr(sys, name, open(os.devnull, "w"))  # noqa: SIM115


def main(argv: list[str] | None = None) -> int:
    _ensure_streams()
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.data_dir:
        os.environ["REPO_RADAR_DATA_DIR"] = args.data_dir

    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from app import run_scheduler_tick

    run_scheduler_tick()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
