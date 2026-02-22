from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import time

from sqlalchemy.orm import Session

from app.models import AgentRun, AgentStep, RunStatus, StepType


@dataclass
class ReplayContext:
    run: AgentRun
    replay: AgentRun


def demo_agent_executor(db: Session, replay: AgentRun) -> None:
    """Deterministic executor used for demo-agent and demo replays."""

    def log(step_type: StepType, name: str, input: dict | None = None, output: dict | None = None):
        start = time.perf_counter()
        time.sleep(0.02)
        latency_ms = (time.perf_counter() - start) * 1000
        step = AgentStep(
            run_id=replay.id,
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

    log(StepType.user_input, "user_input", input={"prompt": replay.input_prompt})
    now = datetime.utcnow().isoformat()
    log(StepType.llm_call, "fake_llm", input={"prompt": replay.input_prompt}, output={"text": now})
    log(StepType.tool_call, "clock", output={"utc": now})

    replay.final_output = now
    replay.status = RunStatus.replayed
    replay.updated_at = datetime.utcnow()
    db.add(replay)
    db.commit()


# Simple agent registry so replay becomes pluggable.
AGENT_EXECUTORS = {
    "demo-agent": demo_agent_executor,
}


def replay_with_executor(db: Session, run: AgentRun) -> AgentRun:
    replay = AgentRun(agent_name=f"{run.agent_name} (replay)", input_prompt=run.input_prompt)
    db.add(replay)
    db.commit()
    db.refresh(replay)

    executor = AGENT_EXECUTORS.get(run.agent_name)
    if executor is None:
        # Fallback: clone steps so you still get a useful artifact.
        for s in run.steps:
            clone = AgentStep(
                run_id=replay.id,
                step_type=s.step_type,
                name=s.name,
                input=s.input,
                output=s.output,
                latency_ms=s.latency_ms,
                cost_usd=s.cost_usd,
                tokens=s.tokens,
                error_message=s.error_message,
            )
            db.add(clone)
            db.commit()

        replay.status = RunStatus.replayed
        replay.final_output = run.final_output
        replay.total_tokens = run.total_tokens
        replay.total_cost_usd = run.total_cost_usd
        replay.updated_at = datetime.utcnow()
        db.add(replay)
        db.commit()
        return replay

    executor(db, replay)
    return replay
