"""add evals

Revision ID: 0002_evals
Revises: 0001_init
Create Date: 2026-02-22

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_evals"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agent_runs", sa.Column("eval_provider", sa.String(length=100), nullable=True))
    op.add_column("agent_runs", sa.Column("eval_scores", sa.JSON(), nullable=True))
    op.add_column("agent_runs", sa.Column("eval_status", sa.String(length=50), nullable=True))

    op.create_table(
        "run_evals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="success"),
        sa.Column("scores", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        if_not_exists=True,
    )

    op.create_index("ix_run_evals_run_id", "run_evals", ["run_id"], if_not_exists=True)
    op.create_index("ix_run_evals_created_at", "run_evals", ["created_at"], if_not_exists=True)
    op.create_index("ix_run_evals_run_created", "run_evals", ["run_id", "created_at"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_run_evals_run_created", table_name="run_evals")
    op.drop_index("ix_run_evals_created_at", table_name="run_evals")
    op.drop_index("ix_run_evals_run_id", table_name="run_evals")
    op.drop_table("run_evals")

    op.drop_column("agent_runs", "eval_status")
    op.drop_column("agent_runs", "eval_scores")
    op.drop_column("agent_runs", "eval_provider")
