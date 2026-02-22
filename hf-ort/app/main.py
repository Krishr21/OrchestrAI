from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="orchestrai-hf-ort")


class GenerateRequest(BaseModel):
    model_id: str = Field(default_factory=lambda: os.environ.get("ORT_MODEL_ID", "distilbert/distilgpt2"))
    prompt: str
    max_new_tokens: int = 128


class GenerateResponse(BaseModel):
    text: str
    latency_ms: float
    engine: str
    model_id: str
    raw: dict[str, Any]


@dataclass
class _Engine:
    name: str

    def generate(self, model_id: str, prompt: str, max_new_tokens: int) -> tuple[str, dict[str, Any]]:
        # Placeholder: wiring actual ORT generation requires model-specific tokenization and decoding.
        # We keep an API-compatible server so the Control Room can integrate cleanly.
        # Next step (optional): swap in optimum.onnxruntime + ORTModelForCausalLM.
        text = (
            f"[hf-ort stub] model_id={model_id} max_new_tokens={max_new_tokens}\n"
            f"Prompt: {prompt}\n\n"
            "Output: (install Optimum + download an ONNX causal LM to enable real generation)"
        )
        return text, {"stub": True}


ENGINE = _Engine(name="stub")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "engine": ENGINE.name,
        "default_model_id": os.environ.get("ORT_MODEL_ID", "distilbert/distilgpt2"),
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    start = time.perf_counter()
    text, raw = ENGINE.generate(req.model_id, req.prompt, req.max_new_tokens)
    latency_ms = (time.perf_counter() - start) * 1000

    return GenerateResponse(
        text=text,
        latency_ms=latency_ms,
        engine=ENGINE.name,
        model_id=req.model_id,
        raw=raw,
    )
