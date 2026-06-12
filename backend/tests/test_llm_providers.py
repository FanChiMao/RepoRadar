from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import llm_providers as llm  # noqa: E402


def _resp(payload: object, status: int = 200):
    value = requests.Response()
    value.status_code = status
    import json as _json

    value._content = _json.dumps(payload).encode("utf-8")
    value.headers["Content-Type"] = "application/json"
    return value


_BASE_ENV = {
    "AZURE_LLM_ENABLED": "true",
    "AZURE_LLM_ENDPOINT": "https://azure.example.com/",
    "AZURE_LLM_API_KEY": "key",
    "AZURE_LLM_API_VERSION": "2024-02-01",
    "AZURE_LLM_MODEL_1": "GPT-4o | openai | gpt4o-deploy",
    "AZURE_LLM_MODEL_2": "Claude | anthropic | claude-3 | novision",
}


def _env(**overrides):
    env = dict(_BASE_ENV)
    env.update(overrides)
    # clear=True so leftover AZURE_LLM_MODEL_* from the real env don't leak in.
    return patch.dict("os.environ", env, clear=True)


class TruthyTests(unittest.TestCase):
    def test_recognizes_truthy_values(self) -> None:
        for value in ("1", "true", "YES", " on "):
            self.assertTrue(llm._truthy(value))

    def test_rejects_other_values(self) -> None:
        for value in ("0", "false", "", "maybe"):
            self.assertFalse(llm._truthy(value))


class LoadAzureConfigTests(unittest.TestCase):
    def test_parses_endpoint_and_models(self) -> None:
        with _env():
            cfg = llm.load_azure_config()
        self.assertTrue(cfg["enabled"])
        self.assertEqual("https://azure.example.com", cfg["endpoint"])
        self.assertEqual(
            {"protocol": "openai", "target": "gpt4o-deploy", "vision": True},
            cfg["models"]["GPT-4o"],
        )
        self.assertFalse(cfg["models"]["Claude"]["vision"])

    def test_skips_malformed_model_entries(self) -> None:
        with _env(
            AZURE_LLM_MODEL_3="onlytwo | openai", AZURE_LLM_MODEL_4="x | bogus | y"
        ):
            cfg = llm.load_azure_config()
        self.assertNotIn("onlytwo", cfg["models"])
        self.assertEqual({"GPT-4o", "Claude"}, set(cfg["models"]))


class ModelLookupTests(unittest.TestCase):
    def test_azure_model_names_empty_when_disabled(self) -> None:
        with _env(AZURE_LLM_ENABLED="false"):
            self.assertEqual([], llm.azure_model_names())

    def test_azure_model_names_lists_configured(self) -> None:
        with _env():
            self.assertEqual(["GPT-4o", "Claude"], llm.azure_model_names())

    def test_is_azure_model(self) -> None:
        with _env():
            self.assertTrue(llm.is_azure_model("Claude"))
            self.assertFalse(llm.is_azure_model("Unknown"))

    def test_azure_protocol(self) -> None:
        with _env():
            self.assertEqual("anthropic", llm.azure_protocol("Claude"))
            self.assertIsNone(llm.azure_protocol("Unknown"))


class VisionTests(unittest.TestCase):
    def test_azure_vision_flag_from_config(self) -> None:
        with _env():
            self.assertTrue(llm.is_vision_model("GPT-4o"))
            self.assertFalse(llm.is_vision_model("Claude"))

    def test_gemini_name_is_vision_when_not_configured(self) -> None:
        with _env(AZURE_LLM_ENABLED="false"):
            self.assertTrue(llm.is_vision_model("gemini-2.0-flash"))
            self.assertFalse(llm.is_vision_model("gemma-2"))

    def test_pick_vision_model_returns_first_supported(self) -> None:
        with _env():
            self.assertEqual("GPT-4o", llm.pick_vision_model(["Claude", "GPT-4o"]))

    def test_pick_vision_model_none_when_all_text(self) -> None:
        with _env(AZURE_LLM_ENABLED="false"):
            self.assertIsNone(llm.pick_vision_model(["gemma-2", ""]))


class GeminiContentsTests(unittest.TestCase):
    def test_maps_roles_and_joins_parts(self) -> None:
        contents = [
            {"role": "user", "parts": [{"text": "hello"}, {"text": "world"}]},
            {"role": "model", "parts": [{"text": "hi"}]},
            {"role": "user", "parts": [{"text": ""}]},
        ]
        self.assertEqual(
            [
                {"role": "user", "text": "hello\nworld"},
                {"role": "assistant", "text": "hi"},
            ],
            llm.gemini_contents_to_messages(contents),
        )


class RequireTests(unittest.TestCase):
    def test_raises_when_endpoint_missing(self) -> None:
        cfg = {"endpoint": "", "api_key": "k", "api_version": "v"}
        with self.assertRaises(RuntimeError):
            llm._require(cfg, need_api_version=False)

    def test_raises_when_api_version_missing_for_openai(self) -> None:
        cfg = {"endpoint": "e", "api_key": "k", "api_version": ""}
        with self.assertRaises(RuntimeError):
            llm._require(cfg, need_api_version=True)

    def test_passes_when_complete(self) -> None:
        cfg = {"endpoint": "e", "api_key": "k", "api_version": "v"}
        llm._require(cfg, need_api_version=True)  # should not raise


class NormalizeAnthropicMessagesTests(unittest.TestCase):
    def test_merges_consecutive_same_role(self) -> None:
        merged = llm._normalize_anthropic_messages(
            [
                {"role": "user", "text": "a"},
                {"role": "user", "text": "b"},
                {"role": "assistant", "text": "c"},
            ]
        )
        self.assertEqual(
            [
                {"role": "user", "content": "a\nb"},
                {"role": "assistant", "content": "c"},
            ],
            merged,
        )

    def test_drops_leading_assistant(self) -> None:
        merged = llm._normalize_anthropic_messages(
            [{"role": "assistant", "text": "intro"}, {"role": "user", "text": "q"}]
        )
        self.assertEqual([{"role": "user", "content": "q"}], merged)


class CallAzureOpenAITests(unittest.TestCase):
    def test_returns_model_text_and_appends_json_hint(self) -> None:
        captured: dict = {}

        def fake_post(url, json, headers, timeout):  # noqa: A002
            captured["json"] = json
            return _resp({"choices": [{"message": {"content": " result "}}]})

        with _env(), patch.object(llm.requests, "post", side_effect=fake_post):
            text = llm.call_azure_openai(
                model="GPT-4o",
                system_instruction="Be terse",
                messages=[{"role": "user", "text": "hi"}],
            )

        self.assertEqual("result", text)
        system = captured["json"]["messages"][0]["content"]
        self.assertIn("json", system.lower())
        self.assertEqual({"type": "json_object"}, captured["json"]["response_format"])

    def test_no_json_format_when_disabled(self) -> None:
        with (
            _env(),
            patch.object(
                llm.requests,
                "post",
                return_value=_resp({"choices": [{"message": {"content": "plain"}}]}),
            ) as post,
        ):
            text = llm.call_azure_openai(
                model="GPT-4o",
                system_instruction="caption this",
                messages=[{"role": "user", "text": "hi"}],
                json_mode=False,
            )
        self.assertEqual("plain", text)
        self.assertNotIn("response_format", post.call_args.kwargs["json"])

    def test_retries_on_429_then_succeeds(self) -> None:
        with (
            _env(),
            patch.object(llm.time, "sleep") as sleep,
            patch.object(
                llm.requests,
                "post",
                side_effect=[
                    _resp({}, 429),
                    _resp({"choices": [{"message": {"content": "ok"}}]}),
                ],
            ) as post,
        ):
            text = llm.call_azure_openai(
                model="GPT-4o",
                system_instruction="s",
                messages=[{"role": "user", "text": "hi"}],
            )
        self.assertEqual("ok", text)
        self.assertEqual(2, post.call_count)
        sleep.assert_called_once()

    def test_empty_response_raises_runtime_error(self) -> None:
        with (
            _env(),
            patch.object(
                llm.requests,
                "post",
                return_value=_resp({"choices": [{"message": {"content": ""}}]}),
            ),
        ):
            with self.assertRaises(RuntimeError):
                llm.call_azure_openai(
                    model="GPT-4o",
                    system_instruction="s",
                    messages=[{"role": "user", "text": "hi"}],
                )

    def test_attaches_images_for_vision_model(self) -> None:
        captured: dict = {}
        image = Mock(ok=True, data=b"bytes")
        image.data_uri.return_value = "data:image/png;base64,Yg=="

        def fake_post(url, json, headers, timeout):  # noqa: A002
            captured["json"] = json
            return _resp({"choices": [{"message": {"content": "seen"}}]})

        with _env(), patch.object(llm.requests, "post", side_effect=fake_post):
            llm.call_azure_openai(
                model="GPT-4o",
                system_instruction="s",
                messages=[{"role": "user", "text": "look"}],
                images=[image],
            )

        content = captured["json"]["messages"][-1]["content"]
        self.assertIsInstance(content, list)
        self.assertEqual("image_url", content[1]["type"])


class CallAzureAnthropicTests(unittest.TestCase):
    def test_returns_joined_text_blocks(self) -> None:
        with (
            _env(),
            patch.object(
                llm.requests,
                "post",
                return_value=_resp(
                    {
                        "content": [
                            {"type": "text", "text": "a"},
                            {"type": "text", "text": "b"},
                            {"type": "tool_use"},
                        ]
                    }
                ),
            ),
        ):
            text = llm.call_azure_anthropic(
                model="Claude",
                system_instruction="sys",
                messages=[{"role": "user", "text": "hi"}],
            )
        self.assertEqual("a\nb", text)

    def test_empty_messages_default_to_single_user(self) -> None:
        captured: dict = {}

        def fake_post(url, json, headers, timeout):  # noqa: A002
            captured["json"] = json
            return _resp({"content": [{"type": "text", "text": "ok"}]})

        with _env(), patch.object(llm.requests, "post", side_effect=fake_post):
            llm.call_azure_anthropic(model="Claude", system_instruction="", messages=[])
        self.assertEqual(
            [{"role": "user", "content": ""}], captured["json"]["messages"]
        )
        self.assertNotIn("system", captured["json"])

    def test_http_error_becomes_runtime_error(self) -> None:
        error = requests.exceptions.HTTPError()
        error.response = Mock(text="bad request detail")
        with _env(), patch.object(llm.requests, "post") as post:
            post.return_value.raise_for_status.side_effect = error
            post.return_value.status_code = 400
            with self.assertRaises(RuntimeError) as raised:
                llm.call_azure_anthropic(
                    model="Claude",
                    system_instruction="s",
                    messages=[{"role": "user", "text": "hi"}],
                )
        self.assertIn("Claude", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
