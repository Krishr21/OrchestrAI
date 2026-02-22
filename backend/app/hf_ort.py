from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class HFOrtResult:
    text: str
    raw: Any


async def hf_ort_generate(
    *,
    base_url: str,
    model_id: str,
    prompt: str,
    max_new_tokens: int = 128,
    timeout_s: float = 120.0,
) -> HFOrtResult:
    """Call the local hf-ort service.

    The service is a lightweight HTTP wrapper that can later be backed by ONNX Runtime
    for fast local inference inside Docker.
    """

    base_url = base_url.rstrip("/")
    payload = {
        "model_id": model_id,
        "prompt": prompt,
        "max_new_tokens": max_new_tokens,
    }

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.post(f"{base_url}/generate", json=payload)
        r.raise_for_status()
        raw = r.json()

    text = raw.get("text") or ""
    return HFOrtResult(text=text, raw=raw)
