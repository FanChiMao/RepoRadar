"""Windows Task Scheduler integration for AI schedules.

The in-app scheduler thread only runs while the RepoRadar (Electron) app is
open. To keep schedules firing *after the app is closed*, we register a Windows
Task Scheduler job that periodically runs the headless tick
(``backend/scheduler_tick.py``). The tick shares the same data dir + dedupe meta
as the in-app loop, so the two never double-send.

Windows-only (``schtasks``). On other platforms the functions report
``supported=False`` so the UI can hide/disable the toggle.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

# Visible name in Task Scheduler. Keep stable — it's the handle for query/delete.
TASK_NAME = "RepoRadar AI Scheduler"


def is_supported() -> bool:
    return sys.platform == "win32"


def _tick_script() -> Path:
    return Path(__file__).resolve().parents[1] / "scheduler_tick.py"


def _background_interpreter() -> str:
    """Prefer ``pythonw.exe`` over ``python.exe`` for the every-minute task.

    ``python.exe`` is a console program, so Task Scheduler flashes a console
    window each time it fires; ``pythonw.exe`` runs windowless. Falls back to the
    current interpreter when no windowless sibling exists (e.g. non-Windows)."""
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        windowless = exe.with_name("pythonw.exe")
        if windowless.exists():
            return str(windowless)
    return str(exe)


def _quote(part: str) -> str:
    return f'"{part}"' if (" " in part or "\t" in part) else part


def build_command(data_dir: str | None = None) -> list[str]:
    """Argv the scheduled task should run each tick: a windowless Python
    interpreter + the headless tick script, pinned to the same data dir so the
    background run reads the same config/schedules the app wrote."""
    parts = [_background_interpreter(), str(_tick_script())]
    if data_dir:
        parts += ["--data-dir", data_dir]
    return parts


def _task_run_string(data_dir: str | None) -> str:
    """schtasks ``/TR`` takes one string; quote any part containing spaces."""
    return " ".join(_quote(part) for part in build_command(data_dir))


def _run(args: list[str]) -> dict[str, Any]:
    try:
        proc = subprocess.run(  # noqa: S603 — fixed schtasks argv, no shell
            args, capture_output=True, text=True
        )
    except OSError as exc:
        return {"ok": False, "returncode": None, "error": str(exc)}
    output = (proc.stdout or "") + (proc.stderr or "")
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "error": "" if proc.returncode == 0 else output.strip(),
    }


def register(data_dir: str | None = None, interval_minutes: int = 1) -> dict[str, Any]:
    """Create/replace the scheduled task. Runs every ``interval_minutes`` (the
    tick is cheap when nothing is due and self-dedupes via the meta file)."""
    if not is_supported():
        return {"ok": False, "error": "Windows 以外的平台不支援工作排程器整合。"}
    args = [
        "schtasks",
        "/Create",
        "/F",  # overwrite an existing task with the same name
        "/SC",
        "MINUTE",
        "/MO",
        str(max(1, int(interval_minutes))),
        "/TN",
        TASK_NAME,
        "/TR",
        _task_run_string(data_dir),
    ]
    result = _run(args)
    result["installed"] = result["ok"]
    return result


def unregister() -> dict[str, Any]:
    if not is_supported():
        return {"ok": False, "error": "Windows 以外的平台不支援工作排程器整合。"}
    result = _run(["schtasks", "/Delete", "/F", "/TN", TASK_NAME])
    result["installed"] = False
    return result


def status() -> dict[str, Any]:
    """Whether the task is currently registered."""
    if not is_supported():
        return {
            "ok": True,
            "supported": False,
            "installed": False,
            "task_name": TASK_NAME,
        }
    query = _run(["schtasks", "/Query", "/TN", TASK_NAME])
    return {
        "ok": True,
        "supported": True,
        "installed": bool(query["ok"]),
        "task_name": TASK_NAME,
    }
