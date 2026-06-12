from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402
from fastapi import HTTPException  # noqa: E402


class ResolveRetrievalModeTests(unittest.TestCase):
    def test_explicit_mode_passes_through(self) -> None:
        self.assertEqual("fast-rag", api_app.resolve_retrieval_mode("q", "fast-rag"))

    def test_invalid_mode_falls_back_to_auto_routing(self) -> None:
        self.assertEqual("fast-rag", api_app.resolve_retrieval_mode("simple", "bogus"))

    def test_auto_routes_context_trace_on_keyword(self) -> None:
        self.assertEqual(
            "context-trace", api_app.resolve_retrieval_mode("為什麼會壞", "auto")
        )

    def test_auto_routes_fast_rag_without_keyword(self) -> None:
        self.assertEqual(
            "fast-rag", api_app.resolve_retrieval_mode("list open issues", "auto")
        )


class ExtractJsonObjectTests(unittest.TestCase):
    def test_plain_json(self) -> None:
        self.assertEqual({"a": 1}, api_app.extract_json_object('{"a": 1}'))

    def test_fenced_json(self) -> None:
        self.assertEqual(
            {"a": 1}, api_app.extract_json_object('```json\n{"a": 1}\n```')
        )

    def test_wrapped_text(self) -> None:
        self.assertEqual(
            {"ok": True},
            api_app.extract_json_object('Here you go: {"ok": true} thanks'),
        )

    def test_empty_raises(self) -> None:
        with self.assertRaises(ValueError):
            api_app.extract_json_object("   ")

    def test_no_json_raises(self) -> None:
        with self.assertRaises(ValueError):
            api_app.extract_json_object("no braces here")


class BuildModelChainTests(unittest.TestCase):
    def test_filters_to_allowed_candidates(self) -> None:
        chain = api_app.build_model_chain(
            preferred_model=None,
            model_candidates=["b", "unknown", "a"],
            default_models=["a", "b", "c"],
        )
        self.assertEqual(["b", "a", "c"], chain)

    def test_preferred_moves_to_front(self) -> None:
        chain = api_app.build_model_chain(
            preferred_model="c",
            model_candidates=["a", "b"],
            default_models=["a", "b", "c"],
        )
        self.assertEqual("c", chain[0])
        self.assertEqual({"a", "b", "c"}, set(chain))

    def test_empty_candidates_use_defaults(self) -> None:
        chain = api_app.build_model_chain(
            preferred_model=None, model_candidates=None, default_models=["a", "b"]
        )
        self.assertEqual(["a", "b"], chain)


class ReplaceImageRefTests(unittest.TestCase):
    def test_replaces_markdown_and_html(self) -> None:
        body = '![alt](https://a.com/1.png) and <img src="https://a.com/1.png">'
        replaced = api_app._replace_image_ref(body, "https://a.com/1.png", "[IMG]")
        self.assertNotIn("https://a.com/1.png", replaced)
        self.assertEqual(2, replaced.count("[IMG]"))


class ArrangeImageLimitsTests(unittest.TestCase):
    def test_defaults(self) -> None:
        with patch.dict("os.environ", {}, clear=False) as _:
            import os

            os.environ.pop("ARRANGE_IMAGE_MAX_COUNT", None)
            os.environ.pop("ARRANGE_IMAGE_MAX_BYTES", None)
            count, size = api_app._arrange_image_limits()
        self.assertEqual(6, count)
        self.assertEqual(4 * 1024 * 1024, size)

    def test_env_override(self) -> None:
        with patch.dict(
            "os.environ",
            {"ARRANGE_IMAGE_MAX_COUNT": "2", "ARRANGE_IMAGE_MAX_BYTES": "1024"},
        ):
            count, size = api_app._arrange_image_limits()
        self.assertEqual(2, count)
        self.assertEqual(1024, size)

    def test_invalid_env_falls_back(self) -> None:
        with patch.dict(
            "os.environ",
            {"ARRANGE_IMAGE_MAX_COUNT": "x", "ARRANGE_IMAGE_MAX_BYTES": "y"},
        ):
            count, size = api_app._arrange_image_limits()
        self.assertEqual(6, count)
        self.assertEqual(4 * 1024 * 1024, size)


class PulseSummaryTests(unittest.TestCase):
    def test_summarizes_schedules(self) -> None:
        summary = api_app._pulse_summary(
            [
                {"enabled": True, "next_run_at": "2026-06-12T00:00", "repo_id": "r1"},
                {"enabled": True, "next_run_at": "2026-06-11T00:00", "repo_id": "r1"},
                {"enabled": False, "last_run_status": "failed", "repo_id": "r2"},
            ]
        )
        self.assertEqual(2, summary["enabled_count"])
        self.assertEqual("2026-06-11T00:00", summary["next_run_at"])
        self.assertEqual(1, summary["recent_failures"])
        self.assertEqual(2, summary["monitored_repos"])


class SimpleEndpointTests(unittest.TestCase):
    def test_health(self) -> None:
        self.assertEqual({"status": "ok"}, api_app.health())

    def test_source_capabilities_wraps_value_error(self) -> None:
        with patch.object(
            api_app, "provider_capabilities", side_effect=ValueError("bad")
        ):
            with self.assertRaises(HTTPException) as raised:
                api_app.get_source_capabilities()
        self.assertEqual(400, raised.exception.status_code)

    def test_source_capabilities_returns_payload(self) -> None:
        with (
            patch.object(api_app, "load_config", return_value={}),
            patch.object(
                api_app, "provider_capabilities", return_value={"sub_issues": True}
            ),
        ):
            self.assertEqual({"sub_issues": True}, api_app.get_source_capabilities())


if __name__ == "__main__":
    unittest.main()
