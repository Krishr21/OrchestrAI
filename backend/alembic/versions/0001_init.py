"""init

Revision ID: 0001_init
Revises: 
Create Date: 2026-02-22

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_name", sa.String(length=200), nullable=False),
        sa.Column("input_prompt", sa.Text(), nullable=False),
        sa.Column("final_output", sa.Text(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        if_not_exists=True,
    )
    op.create_index("ix_agent_runs_agent_name", "agent_runs", ["agent_name"], if_not_exists=True)
    op.create_index("ix_agent_runs_status", "agent_runs", ["status"], if_not_exists=True)

    op.create_table(
        "agent_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_type", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("input", sa.JSON(), nullable=True),
        sa.Column("output", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=True),
        sa.Column("tokens", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        if_not_exists=True,
    )
    op.create_index("ix_agent_steps_run_id", "agent_steps", ["run_id"], if_not_exists=True)
    op.create_index("ix_agent_steps_step_type", "agent_steps", ["step_type"], if_not_exists=True)
    op.create_index("ix_agent_steps_created_at", "agent_steps", ["created_at"], if_not_exists=True)
    op.create_index("ix_agent_steps_run_created", "agent_steps", ["run_id", "created_at"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_agent_steps_run_created", table_name="agent_steps")
    op.drop_index("ix_agent_steps_created_at", table_name="agent_steps")
    op.drop_index("ix_agent_steps_step_type", table_name="agent_steps")
    op.drop_index("ix_agent_steps_run_id", table_name="agent_steps")
    op.drop_table("agent_steps")

    op.drop_index("ix_agent_runs_status", table_name="agent_runs")
    op.drop_index("ix_agent_runs_agent_name", table_name="agent_runs")
    op.drop_table("agent_runs")
