from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class RunStatus(str, enum.Enum):
    running = "running"
    success = "success"
    failed = "failed"
    replayed = "replayed"


class StepType(str, enum.Enum):
    user_input = "user_input"
    llm_call = "llm_call"
    tool_call = "tool_call"
    retrieval = "retrieval"
    agent_log = "agent_log"
    error = "error"


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_name: Mapped[str] = mapped_column(String(200), index=True)
    input_prompt: Mapped[str] = mapped_column(Text)

    final_output: Mapped[str | None] = mapped_column(Text, nullable=True)

    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.running, index=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Latest evaluation snapshot for quick rendering
    eval_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    eval_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    eval_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    steps: Mapped[list[AgentStep]] = relationship(
        "AgentStep",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AgentStep.created_at",
    )

    evals: Mapped[list[RunEval]] = relationship(
        "RunEval",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="RunEval.created_at",
    )


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)

    step_type: Mapped[StepType] = mapped_column(Enum(StepType), index=True)

    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    input: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    run: Mapped[AgentRun] = relationship("AgentRun", back_populates="steps")


Index("ix_agent_steps_run_created", AgentStep.run_id, AgentStep.created_at)


class RunEval(Base):
    __tablename__ = "run_evals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)

    provider: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), default="success")
    scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    run: Mapped[AgentRun] = relationship("AgentRun", back_populates="evals")


Index("ix_run_evals_run_created", RunEval.run_id, RunEval.created_at)
