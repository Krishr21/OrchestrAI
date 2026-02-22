from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class OllamaChatResult:
    content: str
    raw: dict[str, Any]


async def ollama_chat(
    *,
    base_url: str,
    model: str,
    prompt: str,
    timeout_s: float = 120.0,
) -> OllamaChatResult:
    """Call Ollama's /api/chat endpoint and return the assistant content.

    Works with Ollama running locally (e.g. http://host.docker.internal:11434)
    or inside Docker network.
    """

    url = base_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "user", "content": prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    content = (
        (data.get("message") or {}).get("content")
        or data.get("response")
        or ""
    )

    return OllamaChatResult(content=content, raw=data)
