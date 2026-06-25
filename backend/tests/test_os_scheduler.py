from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import os_scheduler  # noqa: E402


class BuildCommandTests(unittest.TestCase):
    def test_includes_interpreter_and_script(self) -> None:
        cmd = os_scheduler.build_command()
        # A Python interpreter (windowless pythonw when available) + the script.
        self.assertIn(
            Path(cmd[0]).name.lower(), {"python.exe", "pythonw.exe", "python"}
        )
        self.assertTrue(cmd[1].endswith("scheduler_tick.py"))
        self.assertNotIn("--data-dir", cmd)

    def test_prefers_windowless_interpreter(self) -> None:
        with patch.object(os_scheduler.sys, "executable", r"C:\py\python.exe"):
            with patch.object(os_scheduler.Path, "exists", return_value=True):
                self.assertEqual(
                    r"C:\py\pythonw.exe", os_scheduler._background_interpreter()
                )
        # No windowless sibling → fall back to the current interpreter.
        with patch.object(os_scheduler.sys, "executable", r"C:\py\python.exe"):
            with patch.object(os_scheduler.Path, "exists", return_value=False):
                self.assertEqual(
                    r"C:\py\python.exe", os_scheduler._background_interpreter()
                )

    def test_appends_data_dir(self) -> None:
        cmd = os_scheduler.build_command(r"C:\data dir")
        self.assertEqual(["--data-dir", r"C:\data dir"], cmd[-2:])

    def test_run_string_quotes_spaced_parts(self) -> None:
        run_string = os_scheduler._task_run_string(r"C:\data dir")
        self.assertIn("--data-dir", run_string)
        self.assertIn('"C:\\data dir"', run_string)


class RegisterTests(unittest.TestCase):
    def test_register_invokes_schtasks_create(self) -> None:
        with (
            patch.object(os_scheduler, "is_supported", return_value=True),
            patch.object(
                os_scheduler,
                "_run",
                return_value={"ok": True, "returncode": 0, "error": ""},
            ) as run,
        ):
            result = os_scheduler.register(data_dir=r"C:\d", interval_minutes=2)
        args = run.call_args.args[0]
        self.assertEqual("schtasks", args[0])
        self.assertIn("/Create", args)
        self.assertIn(os_scheduler.TASK_NAME, args)
        self.assertEqual("2", args[args.index("/MO") + 1])
        self.assertTrue(result["ok"])
        self.assertTrue(result["installed"])

    def test_register_unsupported_platform(self) -> None:
        with patch.object(os_scheduler, "is_supported", return_value=False):
            result = os_scheduler.register()
        self.assertFalse(result["ok"])

    def test_unregister_invokes_delete(self) -> None:
        with (
            patch.object(os_scheduler, "is_supported", return_value=True),
            patch.object(
                os_scheduler,
                "_run",
                return_value={"ok": True, "returncode": 0, "error": ""},
            ) as run,
        ):
            result = os_scheduler.unregister()
        args = run.call_args.args[0]
        self.assertIn("/Delete", args)
        self.assertFalse(result["installed"])

    def test_status_reports_installed_when_query_ok(self) -> None:
        with (
            patch.object(os_scheduler, "is_supported", return_value=True),
            patch.object(
                os_scheduler,
                "_run",
                return_value={"ok": True, "returncode": 0, "error": ""},
            ),
        ):
            status = os_scheduler.status()
        self.assertTrue(status["supported"])
        self.assertTrue(status["installed"])

    def test_status_unsupported(self) -> None:
        with patch.object(os_scheduler, "is_supported", return_value=False):
            status = os_scheduler.status()
        self.assertFalse(status["supported"])
        self.assertFalse(status["installed"])


if __name__ == "__main__":
    unittest.main()
