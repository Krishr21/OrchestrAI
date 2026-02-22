from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class TGIResult:
    text: str
    raw: Any


async def tgi_generate(*, base_url: str, prompt: str, max_new_tokens: int = 256) -> TGIResult:
    """Call a local Hugging Face Text Generation Inference (TGI) server.

    TGI docs: https://github.com/huggingface/text-generation-inference

    We use the OpenAI-like endpoint (`/v1/completions`) for simplicity.
    """

    base_url = base_url.rstrip("/")

    payload = {
        "model": "local",  # ignored by TGI, but required by schema
        "prompt": prompt,
        "max_tokens": max_new_tokens,
        "temperature": 0.2,
    }

    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{base_url}/v1/completions", json=payload)
        r.raise_for_status()
        raw = r.json()

    # Expected shape: { choices: [ { text: "..." } ] }
    text = ""
    try:
        text = (raw.get("choices") or [{}])[0].get("text") or ""
    except Exception:
        text = ""

    return TGIResult(text=text, raw=raw)
