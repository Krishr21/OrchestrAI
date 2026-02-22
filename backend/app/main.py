from __future__ import annotations

import time
from datetime import datetime
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
import os

from alembic import command
from alembic.config import Config

from app.db import get_db
from app.events import publish_step
from app.models import AgentRun, AgentStep, RunStatus, StepType
from app.replay import replay_with_executor
from app.schemas import (
    AgentRunDetailOut,
    AgentRunOut,
    ApiRunCreate,
    HuggingFaceRunCreate,
    OllamaRunCreate,
    RunCreate,
    RunUpdate,
    StepCreate,
)
from app.ollama import ollama_chat
from app.hf_ort import hf_ort_generate
from app.model_apis import anthropic_messages, gemini_generate, openai_chat
from app.tracing import setup_tracing
from app.worker import celery_app
from app.ws import stream_run_steps

setup_tracing()
tracer = trace.get_tracer(__name__)

app = FastAPI(title="OrchestrAI Agent Control Room API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    # Apply Alembic migrations on startup.
    # This keeps schema versioned and avoids relying on SQLAlchemy create_all.
    # /app/app/main.py -> /app/alembic.ini
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    # Ensure Alembic sees DATABASE_URL from container env.
    if os.environ.get("DATABASE_URL"):
        cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "time": datetime.utcnow().isoformat()}


@app.websocket("/ws/runs/{run_id}")
async def ws_run_steps(websocket: WebSocket, run_id: int):
    await stream_run_steps(websocket, run_id)


@app.post("/runs", response_model=AgentRunOut)
def create_run(payload: RunCreate, db: Session = Depends(get_db)):
    run = AgentRun(agent_name=payload.agent_name, input_prompt=payload.input_prompt)
    db.add(run)
    db.commit()
    db.refresh(run)

    step = AgentStep(
        run_id=run.id,
        step_type=StepType.user_input,
        name="user_input",
        input={"prompt": payload.input_prompt},
    )
    db.add(step)
    db.commit()

    publish_step(
        run.id,
        {
            "event": "step",
            "run_id": run.id,
            "step": {
                "id": step.id,
                "run_id": step.run_id,
                "step_type": step.step_type,
                "name": step.name,
                "input": step.input,
                "output": step.output,
                "latency_ms": step.latency_ms,
                "cost_usd": step.cost_usd,
                "tokens": step.tokens,
                "error_message": step.error_message,
                "created_at": step.created_at,
            },
        },
    )
    return run


@app.get("/runs", response_model=list[AgentRunOut])
def list_runs(db: Session = Depends(get_db), limit: int = 50, offset: int = 0):
    q = select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(q))


@app.get("/runs/{run_id}", response_model=AgentRunDetailOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    # relationship loads steps
    _ = run.steps
    return run


@app.delete("/runs/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    db.delete(run)
    db.commit()
    return JSONResponse({"ok": True, "run_id": run_id})


@app.patch("/runs/{run_id}", response_model=AgentRunOut)
def update_run(run_id: int, payload: RunUpdate, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(run, k, v)

    run.updated_at = datetime.utcnow()
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@app.post("/runs/{run_id}/steps")
def add_step(run_id: int, payload: StepCreate, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    step = AgentStep(
        run_id=run_id,
        step_type=payload.step_type,  # type: ignore[arg-type]
        name=payload.name,
        input=payload.input,
        output=payload.output,
        latency_ms=payload.latency_ms,
        cost_usd=payload.cost_usd,
        tokens=payload.tokens,
        error_message=payload.error_message,
    )

    db.add(step)
    db.commit()
    db.refresh(step)

    publish_step(
        run_id,
        {
            "event": "step",
            "run_id": run_id,
            "step": {
                "id": step.id,
                "run_id": step.run_id,
                "step_type": step.step_type,
                "name": step.name,
                "input": step.input,
                "output": step.output,
                "latency_ms": step.latency_ms,
                "cost_usd": step.cost_usd,
                "tokens": step.tokens,
                "error_message": step.error_message,
                "created_at": step.created_at,
            },
        },
    )
    return {"ok": True, "step_id": step.id}


@app.post("/runs/{run_id}/replay")
def replay_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")

    # Replay engine: uses a pluggable executor registry.
    with tracer.start_as_current_span("replay_run") as span:
        span.set_attribute("run_id", run_id)

        replay = replay_with_executor(db, run)

    return {"ok": True, "replay_run_id": replay.id}


@app.post("/runs/{run_id}/evaluate")
def evaluate(run_id: int):
    # async evaluation stub
    job = celery_app.send_task("orchestrai.evaluate_run", args=[run_id])
    return {"ok": True, "task_id": job.id}


@app.post("/ollama/run")
async def ollama_run(payload: OllamaRunCreate, db: Session = Depends(get_db)):
    """Run an agent using a real local model served by Ollama.

    Env vars (set on backend service):
    - OLLAMA_BASE_URL (default: http://host.docker.internal:11434)
    - OLLAMA_MODEL (default: llama3.1:8b)
    """

    base_url = payload.base_url or os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    model = payload.model or os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

    run = AgentRun(agent_name="ollama-agent", input_prompt=payload.input_prompt)
    db.add(run)
    db.commit()
    db.refresh(run)

    def log(
        step_type: StepType,
        name: str,
        input: dict | None = None,
        output: dict | None = None,
        latency_ms: float | None = None,
        error_message: str | None = None,
    ):
        step = AgentStep(
            run_id=run.id,
            step_type=step_type,
            name=name,
            input=input,
            output=output,
            latency_ms=latency_ms,
            cost_usd=0.0,
            tokens=0,
            error_message=error_message,
        )
        db.add(step)
        db.commit()
        db.refresh(step)

        publish_step(
            run.id,
            {
                "event": "step",
                "run_id": run.id,
                "step": {
                    "id": step.id,
                    "run_id": step.run_id,
                    "step_type": step.step_type,
                    "name": step.name,
                    "input": step.input,
                    "output": step.output,
                    "latency_ms": step.latency_ms,
                    "cost_usd": step.cost_usd,
                    "tokens": step.tokens,
                    "error_message": step.error_message,
                    "created_at": step.created_at,
                },
            },
        )

    log(StepType.user_input, "user_input", input={"prompt": payload.input_prompt})

    start = time.perf_counter()
    try:
        result = await ollama_chat(base_url=base_url, model=model, prompt=payload.input_prompt)
        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.llm_call,
            "ollama_chat",
            input={"base_url": base_url, "model": model, "prompt": payload.input_prompt},
            output={"text": result.content, "raw": result.raw},
            latency_ms=latency_ms,
        )
        run.final_output = result.content
        run.status = RunStatus.success
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        return {"ok": True, "run_id": run.id}
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.error,
            "ollama_error",
            input={"base_url": base_url, "model": model},
            latency_ms=latency_ms,
            error_message=str(e),
        )
        run.status = RunStatus.failed
        run.error_message = str(e)
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        raise


@app.post("/hf/run")
async def huggingface_run(payload: HuggingFaceRunCreate, db: Session = Depends(get_db)):
    """Run an agent using a local Hugging Face inference server.

    Default is a local hf-ort container, accessible from Docker via:
    - HF_ORT_BASE_URL (default: http://hf-ort:8080)
    """

    base_url = payload.base_url or os.environ.get("HF_ORT_BASE_URL", "http://hf-ort:8080")
    model_id = payload.model_id or os.environ.get("HF_ORT_MODEL_ID", "distilbert/distilgpt2")

    run = AgentRun(agent_name="hf-tgi-agent", input_prompt=payload.input_prompt)
    db.add(run)
    db.commit()
    db.refresh(run)

    def log(
        step_type: StepType,
        name: str,
        input: dict | None = None,
        output: dict | None = None,
        latency_ms: float | None = None,
        error_message: str | None = None,
    ):
        step = AgentStep(
            run_id=run.id,
            step_type=step_type,
            name=name,
            input=input,
            output=output,
            latency_ms=latency_ms,
            cost_usd=0.0,
            tokens=0,
            error_message=error_message,
        )
        db.add(step)
        db.commit()
        db.refresh(step)

        publish_step(
            run.id,
            {
                "event": "step",
                "run_id": run.id,
                "step": {
                    "id": step.id,
                    "run_id": step.run_id,
                    "step_type": step.step_type,
                    "name": step.name,
                    "input": step.input,
                    "output": step.output,
                    "latency_ms": step.latency_ms,
                    "cost_usd": step.cost_usd,
                    "tokens": step.tokens,
                    "error_message": step.error_message,
                    "created_at": step.created_at,
                },
            },
        )

    log(StepType.user_input, "user_input", input={"prompt": payload.input_prompt})

    start = time.perf_counter()
    try:
        result = await hf_ort_generate(
            base_url=base_url,
            model_id=model_id,
            prompt=payload.input_prompt,
            max_new_tokens=payload.max_new_tokens,
        )
        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.llm_call,
            "hf_ort_generate",
            input={
                "base_url": base_url,
                "model_id": model_id,
                "prompt": payload.input_prompt,
                "max_new_tokens": payload.max_new_tokens,
            },
            output={"text": result.text, "raw": result.raw},
            latency_ms=latency_ms,
        )
        run.final_output = result.text
        run.status = RunStatus.success
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        return {"ok": True, "run_id": run.id}
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.error,
            "hf_ort_error",
            input={"base_url": base_url, "model_id": model_id},
            latency_ms=latency_ms,
            error_message=str(e),
        )
        run.status = RunStatus.failed
        run.error_message = str(e)
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        raise


@app.post("/api/run")
async def api_run(payload: ApiRunCreate, db: Session = Depends(get_db)):
    """Run an agent using a hosted model API (OpenAI, Anthropic/Claude, Gemini)."""

    run = AgentRun(agent_name=f"api:{payload.provider}", input_prompt=payload.input_prompt)
    db.add(run)
    db.commit()
    db.refresh(run)

    def log(
        step_type: StepType,
        name: str,
        input: dict | None = None,
        output: dict | None = None,
        latency_ms: float | None = None,
        error_message: str | None = None,
    ):
        step = AgentStep(
            run_id=run.id,
            step_type=step_type,
            name=name,
            input=input,
            output=output,
            latency_ms=latency_ms,
            cost_usd=0.0,
            tokens=0,
            error_message=error_message,
        )
        db.add(step)
        db.commit()
        db.refresh(step)

        publish_step(
            run.id,
            {
                "event": "step",
                "run_id": run.id,
                "step": {
                    "id": step.id,
                    "run_id": step.run_id,
                    "step_type": step.step_type,
                    "name": step.name,
                    "input": step.input,
                    "output": step.output,
                    "latency_ms": step.latency_ms,
                    "cost_usd": step.cost_usd,
                    "tokens": step.tokens,
                    "error_message": step.error_message,
                    "created_at": step.created_at,
                },
            },
        )

    log(StepType.user_input, "user_input", input={"prompt": payload.input_prompt})

    start = time.perf_counter()
    try:
        if payload.provider == "openai":
            result = await openai_chat(
                api_key=payload.api_key,
                model=payload.model,
                prompt=payload.input_prompt,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
            )
        elif payload.provider == "anthropic":
            result = await anthropic_messages(
                api_key=payload.api_key,
                model=payload.model,
                prompt=payload.input_prompt,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
            )
        elif payload.provider == "gemini":
            result = await gemini_generate(
                api_key=payload.api_key,
                model=payload.model,
                prompt=payload.input_prompt,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
            )
        else:
            raise HTTPException(status_code=400, detail="unsupported provider")

        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.llm_call,
            "api_model_call",
            input={
                "provider": payload.provider,
                "model": payload.model,
                "temperature": payload.temperature,
                "max_tokens": payload.max_tokens,
            },
            output={"text": result.text, "usage": result.usage, "raw": result.raw},
            latency_ms=latency_ms,
        )

        run.final_output = result.text
        run.status = RunStatus.success
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        return {"ok": True, "run_id": run.id}
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        log(
            StepType.error,
            "api_model_error",
            input={"provider": payload.provider, "model": payload.model},
            latency_ms=latency_ms,
            error_message=str(e),
        )
        run.status = RunStatus.failed
        run.error_message = str(e)
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()
        raise


@app.post("/demo/run")
def demo_run(db: Session = Depends(get_db)) -> dict[str, Any]:
    # A free, deterministic 'agent' run that demonstrates step logging + failure.
    prompt = "Find the current date and format it as ISO."  # deterministic locally
    run = AgentRun(agent_name="demo-agent", input_prompt=prompt)
    db.add(run)
    db.commit()
    db.refresh(run)

    def log(step_type: StepType, name: str, input: dict | None = None, output: dict | None = None):
        start = time.perf_counter()
        time.sleep(0.05)
        latency_ms = (time.perf_counter() - start) * 1000
        step = AgentStep(
            run_id=run.id,
            step_type=step_type,
            name=name,
            input=input,
            output=output,
            latency_ms=latency_ms,
            cost_usd=0.0,
            tokens=0,
        )
        db.add(step)
        db.commit()

    with tracer.start_as_current_span("demo_agent_run") as span:
        span.set_attribute("agent", "demo-agent")
        log(StepType.user_input, "user_input", input={"prompt": prompt})

        now = datetime.utcnow().isoformat()
        log(StepType.llm_call, "fake_llm", input={"prompt": prompt}, output={"text": now})

        # simulate a tool call
        log(StepType.tool_call, "clock", output={"utc": now})

        run.final_output = now
        run.status = RunStatus.success
        run.updated_at = datetime.utcnow()
        db.add(run)
        db.commit()

    return {"ok": True, "run_id": run.id}
