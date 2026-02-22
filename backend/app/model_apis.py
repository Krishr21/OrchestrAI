from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass
class ApiTextResult:
    text: str
    raw: dict
    usage: dict | None = None


def _pick_key(explicit: str | None, env_name: str) -> str:
    key = (explicit or os.environ.get(env_name) or "").strip()
    if not key:
        raise RuntimeError(f"Missing API key. Set {env_name} on the backend service or pass api_key.")
    return key


async def openai_chat(*, api_key: str | None, model: str, prompt: str, temperature: float | None, max_tokens: int | None) -> ApiTextResult:
    key = _pick_key(api_key, "OPENAI_API_KEY")
    url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + "/chat/completions"

    payload: dict = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, json=payload, headers=headers)
        res.raise_for_status()
        data = res.json()

    choice0 = (data.get("choices") or [{}])[0]
    msg = choice0.get("message") or {}
    text = msg.get("content") or ""
    usage = data.get("usage")

    return ApiTextResult(text=text, raw=data, usage=usage)


async def anthropic_messages(*, api_key: str | None, model: str, prompt: str, temperature: float | None, max_tokens: int | None) -> ApiTextResult:
    key = _pick_key(api_key, "ANTHROPIC_API_KEY")
    url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1").rstrip("/") + "/messages"

    payload: dict = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens or 512,
    }
    if temperature is not None:
        payload["temperature"] = temperature

    headers = {
        "x-api-key": key,
        "anthropic-version": os.environ.get("ANTHROPIC_VERSION", "2023-06-01"),
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, json=payload, headers=headers)
        res.raise_for_status()
        data = res.json()

    # content is a list of blocks
    blocks = data.get("content") or []
    text_parts = []
    for b in blocks:
        if isinstance(b, dict) and b.get("type") == "text":
            text_parts.append(b.get("text") or "")
    text = "".join(text_parts)

    usage = data.get("usage")
    # normalize anthropic usage keys a bit
    if usage and isinstance(usage, dict):
        usage = {
            "input_tokens": usage.get("input_tokens"),
            "output_tokens": usage.get("output_tokens"),
        }

    return ApiTextResult(text=text, raw=data, usage=usage)


async def gemini_generate(*, api_key: str | None, model: str, prompt: str, temperature: float | None, max_tokens: int | None) -> ApiTextResult:
    key = _pick_key(api_key, "GEMINI_API_KEY")
    base = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    url = f"{base}/models/{model}:generateContent"

    generation_config: dict = {}
    if temperature is not None:
        generation_config["temperature"] = temperature
    if max_tokens is not None:
        generation_config["maxOutputTokens"] = max_tokens

    payload: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
    }
    if generation_config:
        payload["generationConfig"] = generation_config

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, params={"key": key}, json=payload)
        res.raise_for_status()
        data = res.json()

    # candidates[0].content.parts[].text
    c0 = (data.get("candidates") or [{}])[0]
    content = c0.get("content") or {}
    parts = content.get("parts") or []
    text = "".join([(p.get("text") or "") for p in parts if isinstance(p, dict)])

    usage = data.get("usageMetadata")
    if usage and isinstance(usage, dict):
        usage = {
            "prompt_tokens": usage.get("promptTokenCount"),
            "completion_tokens": usage.get("candidatesTokenCount"),
            "total_tokens": usage.get("totalTokenCount"),
        }

    return ApiTextResult(text=text, raw=data, usage=usage)
