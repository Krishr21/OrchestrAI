from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


RunStatus = Literal["running", "success", "failed", "replayed"]
StepType = Literal[
    "user_input",
    "llm_call",
    "tool_call",
    "retrieval",
    "agent_log",
    "error",
]


class RunCreate(BaseModel):
    agent_name: str = Field(..., max_length=200)
    input_prompt: str


class OllamaRunCreate(BaseModel):
    """Request payload for creating a run backed by a local Ollama model."""

    input_prompt: str
    model: str | None = None
    base_url: str | None = None


class HuggingFaceRunCreate(BaseModel):
    """Request payload for creating a run backed by a local Hugging Face inference server.

    This is designed for local/free setups via Text Generation Inference (TGI).
    """

    input_prompt: str
    model_id: str | None = None
    base_url: str | None = None
    max_new_tokens: int = 128


ApiProvider = Literal["openai", "anthropic", "gemini"]


class ApiRunCreate(BaseModel):
    """Run using a hosted model API (OpenAI, Anthropic/Claude, Gemini).

    Keys are typically configured via env vars on the backend container:
    - OPENAI_API_KEY
    - ANTHROPIC_API_KEY
    - GEMINI_API_KEY

    You may also pass api_key for quick testing; it is never stored.
    """

    provider: ApiProvider
    model: str
    input_prompt: str
    api_key: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class RunUpdate(BaseModel):
    status: RunStatus | None = None
    final_output: str | None = None
    total_tokens: int | None = None
    total_cost_usd: float | None = None
    error_message: str | None = None


class StepCreate(BaseModel):
    step_type: StepType
    name: str | None = None
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    latency_ms: float | None = None
    cost_usd: float | None = None
    tokens: int | None = None
    error_message: str | None = None


class AgentStepOut(BaseModel):
    id: int
    run_id: int
    step_type: StepType
    name: str | None
    input: dict[str, Any] | None
    output: dict[str, Any] | None
    latency_ms: float | None
    cost_usd: float | None
    tokens: int | None
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AgentRunOut(BaseModel):
    id: int
    agent_name: str
    input_prompt: str
    final_output: str | None
    total_tokens: int
    total_cost_usd: float
    status: RunStatus
    error_message: str | None

    eval_provider: str | None = None
    eval_scores: dict[str, Any] | None = None
    eval_status: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentRunDetailOut(AgentRunOut):
    steps: list[AgentStepOut]
