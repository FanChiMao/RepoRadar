from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import utils  # noqa: E402


@dataclass
class _Sample:
    name: str
    value: int


class UtcNowTests(unittest.TestCase):
    def test_returns_timezone_aware_utc(self) -> None:
        now = utils.utc_now()
        self.assertEqual(UTC, now.tzinfo)


class ParseDtTests(unittest.TestCase):
    def test_returns_none_for_empty_value(self) -> None:
        self.assertIsNone(utils.parse_dt(None))
        self.assertIsNone(utils.parse_dt(""))

    def test_parses_zulu_suffix(self) -> None:
        parsed = utils.parse_dt("2026-06-10T12:00:00Z")
        self.assertEqual(datetime(2026, 6, 10, 12, 0, tzinfo=UTC), parsed)

    def test_parses_offset_iso_string(self) -> None:
        parsed = utils.parse_dt("2026-06-10T12:00:00+00:00")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(2026, parsed.year)

    def test_returns_none_for_invalid_value(self) -> None:
        self.assertIsNone(utils.parse_dt("not-a-date"))


class JsonRoundTripTests(unittest.TestCase):
    def _tmp_path(self, name: str = "data.json") -> Path:
        import shutil
        import uuid

        base = BACKEND_DIR / "data" / f"test-utils-{uuid.uuid4().hex}"
        base.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, base, True)
        return base / name

    def test_read_json_returns_default_when_missing(self) -> None:
        path = self._tmp_path()
        self.assertEqual({"fallback": True}, utils.read_json(path, {"fallback": True}))

    def test_write_then_read_round_trips_payload(self) -> None:
        path = self._tmp_path("nested/dir/data.json")
        utils.write_json(path, {"a": 1, "b": "値"})
        self.assertTrue(path.exists())
        self.assertEqual({"a": 1, "b": "値"}, utils.read_json(path, None))

    def test_write_json_serializes_dataclass(self) -> None:
        path = self._tmp_path()
        utils.write_json(path, _Sample(name="x", value=7))
        self.assertEqual({"name": "x", "value": 7}, utils.read_json(path, None))

    def test_read_json_returns_default_on_corrupt_file(self) -> None:
        path = self._tmp_path()
        utils.ensure_parent(path)
        path.write_text("{ not json", encoding="utf-8")
        self.assertEqual([], utils.read_json(path, []))


if __name__ == "__main__":
    unittest.main()
