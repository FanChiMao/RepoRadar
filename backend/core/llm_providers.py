"""Azure-hosted LLM providers (OpenAI chat + Anthropic messages protocols).

設定來自環境變數（見 backend/.env.example）。本模組只負責「組請求、打 Azure、回傳
模型輸出的純文字」；JSON 解析沿用 app.py 的 extract_json_object，與 Gemini 路徑一致。

兩種協定：
  openai     → POST {ENDPOINT}/openai/deployments/{deploy}/chat/completions?api-version=...
  anthropic  → POST {ENDPOINT}/anthropic/v1/messages
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import requests

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ModuleNotFoundError:
    pass

ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MAX_TOKENS = 4096
_TRUTHY = {"1", "true", "yes", "on"}


def _truthy(value: Any) -> bool:
    return str(value).strip().lower() in _TRUTHY


def load_azure_config() -> dict[str, Any]:
    """讀取環境變數並解析出 Azure 設定。每次呼叫即時讀取（成本低）。"""
    endpoint = os.environ.get("AZURE_LLM_ENDPOINT", "").strip().rstrip("/")
    api_key = os.environ.get("AZURE_LLM_API_KEY", "").strip()
    api_version = os.environ.get("AZURE_LLM_API_VERSION", "").strip()

    models: dict[str, dict[str, str]] = {}
    # 支援 AZURE_LLM_MODEL_1 .. _20，格式：顯示名 | protocol | deployment或model-id
    for i in range(1, 21):
        raw = os.environ.get(f"AZURE_LLM_MODEL_{i}", "").strip()
        if not raw:
            continue
        parts = [p.strip() for p in raw.split("|")]
        if len(parts) < 3:
            continue
        display, protocol, target = parts[0], parts[1].lower(), parts[2]
        if not display or protocol not in {"openai", "anthropic"} or not target:
            continue
        # 可選第 4 欄：vision / novision（預設視為支援視覺）
        vision_field = parts[3].strip().lower() if len(parts) >= 4 else ""
        vision = vision_field not in {"novision", "no-vision", "false", "text"}
        models[display] = {
            "protocol": protocol,
            "target": target,
            "vision": vision,
        }

    return {
        "enabled": _truthy(os.environ.get("AZURE_LLM_ENABLED", "")),
        "endpoint": endpoint,
        "api_key": api_key,
        "api_version": api_version,
        "models": models,
    }


def azure_model_names() -> list[str]:
    cfg = load_azure_config()
    if not cfg["enabled"]:
        return []
    return list(cfg["models"].keys())


def is_azure_model(name: str) -> bool:
    cfg = load_azure_config()
    return bool(cfg["enabled"]) and name in cfg["models"]


def azure_protocol(name: str) -> str | None:
    cfg = load_azure_config()
    entry = cfg["models"].get(name)
    return entry["protocol"] if entry else None


def is_vision_model(name: str) -> bool:
    """是否支援讀圖（多模態）。Azure 看設定第 4 欄；Gemini 系列可、Gemma 不可。"""
    cfg = load_azure_config()
    entry = cfg["models"].get(name)
    if entry is not None:
        return bool(entry.get("vision", True))
    lowered = (name or "").lower()
    return lowered.startswith("gemini")


def pick_vision_model(candidates: list[str]) -> str | None:
    """依序回傳第一個支援視覺的模型名稱；皆不支援則 None。"""
    for name in candidates:
        if name and is_vision_model(name):
            return name
    return None


def gemini_contents_to_messages(contents: list[dict[str, Any]]) -> list[dict[str, str]]:
    """把 Gemini 形式的 contents（role=user/model, parts=[{text}]）轉成
    通用 messages（role=user/assistant, text）。"""
    out: list[dict[str, str]] = []
    for item in contents:
        role = "assistant" if item.get("role") == "model" else "user"
        text = "\n".join(
            part.get("text", "") for part in item.get("parts", []) if part.get("text")
        ).strip()
        if text:
            out.append({"role": role, "text": text})
    return out


def _require(cfg: dict[str, Any], *, need_api_version: bool) -> None:
    if not cfg["endpoint"]:
        raise RuntimeError("AZURE_LLM_ENDPOINT 未設定。")
    if not cfg["api_key"]:
        raise RuntimeError("AZURE_LLM_API_KEY 未設定。")
    if need_api_version and not cfg["api_version"]:
        raise RuntimeError("AZURE_LLM_API_VERSION 未設定（openai 協定需要）。")


def call_azure_openai(
    *,
    model: str,
    system_instruction: str,
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    timeout: int = 90,
    images: list[Any] | None = None,
    json_mode: bool = True,
) -> str:
    """OpenAI chat-completions 協定。回傳模型輸出的純文字。

    images：ImageAsset 清單，有值且模型支援視覺時附到最後一則 user 訊息。
    json_mode：True 時用 response_format=json_object（arrange/chat/summary）；
               caption 等純文字用途設 False。
    """
    cfg = load_azure_config()
    _require(cfg, need_api_version=True)
    entry = cfg["models"][model]
    url = (
        f"{cfg['endpoint']}/openai/deployments/{entry['target']}"
        f"/chat/completions?api-version={cfg['api_version']}"
    )
    # 認證 header：Azure AI Services / Azure OpenAI 標準為 api-key。
    # 若實測 401，改成 {"Authorization": f"Bearer {cfg['api_key']}"} 即可。
    headers = {"api-key": cfg["api_key"], "content-type": "application/json"}

    # 使用 response_format=json_object 時，OpenAI 規定 messages 內必須出現 "json" 字樣，
    # 否則回 400（gpt-5 系列嚴格執行此規則）。若系統提示沒有就補一句。
    system_content = system_instruction or ""
    if json_mode and "json" not in system_content.lower():
        system_content = (system_content + "\n\n請以單一有效的 JSON 物件回覆。").strip()

    oai_messages: list[dict[str, Any]] = [{"role": "system", "content": system_content}]
    for msg in messages:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        oai_messages.append({"role": role, "content": msg.get("text", "")})

    if images and oai_messages[-1]["role"] != "system":
        parts: list[dict[str, Any]] = [
            {"type": "text", "text": oai_messages[-1]["content"]}
        ]
        for img in images:
            if getattr(img, "ok", False) and getattr(img, "data", b""):
                parts.append(
                    {"type": "image_url", "image_url": {"url": img.data_uri()}}
                )
        if len(parts) > 1:
            oai_messages[-1]["content"] = parts

    payload: dict[str, Any] = {
        "messages": oai_messages,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error = "Unknown Azure OpenAI error."
    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 429:
                time.sleep(2**attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                raise ValueError("No choices returned.")
            content = (choices[0].get("message") or {}).get("content", "")
            text = content.strip() if isinstance(content, str) else ""
            if not text:
                raise ValueError("Empty model response.")
            return text
        except requests.exceptions.HTTPError as exc:
            last_error = (
                exc.response.text[:500] if exc.response is not None else str(exc)
            )
            break
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            break

    raise RuntimeError(f"Azure OpenAI ({model}) failed: {last_error}")


def _normalize_anthropic_messages(
    messages: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Anthropic 要求 messages 以 user 開頭並 user/assistant 交替。
    合併連續同 role、丟掉開頭的 assistant。"""
    merged: list[dict[str, str]] = []
    for msg in messages:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        text = msg.get("text", "")
        if merged and merged[-1]["role"] == role:
            merged[-1]["content"] = f"{merged[-1]['content']}\n{text}".strip()
        else:
            merged.append({"role": role, "content": text})
    while merged and merged[0]["role"] == "assistant":
        merged.pop(0)
    return merged


def call_azure_anthropic(
    *,
    model: str,
    system_instruction: str,
    messages: list[dict[str, str]],
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: int = 90,
    images: list[Any] | None = None,
) -> str:
    """Anthropic Messages 協定。回傳模型輸出的純文字。

    注意：不送 temperature/top_p（Claude Opus 4.x 新模型會 400）。
    JSON 輸出靠 system prompt 指示，由呼叫端的 extract_json_object 解析。
    """
    cfg = load_azure_config()
    _require(cfg, need_api_version=False)
    entry = cfg["models"][model]
    url = f"{cfg['endpoint']}/anthropic/v1/messages"
    # 認證 header：實測此 Azure gateway 的 anthropic 路徑需要 x-api-key（api-key 會 401）。
    # Authorization: Bearer <key> 也可，但採用 Anthropic 慣用的 x-api-key + anthropic-version。
    headers = {
        "x-api-key": cfg["api_key"],
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    a_messages = _normalize_anthropic_messages(messages)
    if not a_messages:
        a_messages = [{"role": "user", "content": ""}]

    if images:
        last = a_messages[-1]
        blocks: list[dict[str, Any]] = [{"type": "text", "text": last["content"]}]
        for img in images:
            if getattr(img, "ok", False) and getattr(img, "data", b""):
                blocks.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.base64_data(),
                        },
                    }
                )
        if len(blocks) > 1:
            last["content"] = blocks

    payload: dict[str, Any] = {
        "model": entry["target"],
        "max_tokens": max_tokens,
        "messages": a_messages,
    }
    if system_instruction:
        payload["system"] = system_instruction

    last_error = "Unknown Azure Anthropic error."
    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 429:
                time.sleep(2**attempt)
                continue
            resp.raise_for_status()
            data = resp.json()
            blocks = data.get("content") or []
            text = "\n".join(
                block.get("text", "")
                for block in blocks
                if block.get("type") == "text" and block.get("text")
            ).strip()
            if not text:
                raise ValueError("Empty model response.")
            return text
        except requests.exceptions.HTTPError as exc:
            last_error = (
                exc.response.text[:500] if exc.response is not None else str(exc)
            )
            break
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            break

    raise RuntimeError(f"Azure Anthropic ({model}) failed: {last_error}")
