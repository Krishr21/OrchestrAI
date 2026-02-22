from __future__ import annotations

from celery import Celery

from app.db import SessionLocal
from app.evals import offline_basic_eval
from app.models import AgentRun, RunEval

from app.config import settings

celery_app = Celery(
    "orchestrai",
    broker=settings.redis_url,
    backend=settings.redis_url,
)


@celery_app.task(name="orchestrai.evaluate_run")
def evaluate_run(run_id: int) -> dict:
    db = SessionLocal()
    try:
        run = db.get(AgentRun, run_id)
        if not run:
            return {"ok": False, "error": "run not found", "run_id": run_id}

        result = offline_basic_eval(run.input_prompt, run.final_output)

        ev = RunEval(run_id=run_id, provider=result.provider, status="success", scores=result.scores, notes=result.notes)
        db.add(ev)

        # Update latest snapshot on run for fast reads
        run.eval_provider = result.provider
        run.eval_scores = result.scores
        run.eval_status = "success"

        db.add(run)
        db.commit()
        db.refresh(ev)

        return {"ok": True, "run_id": run_id, "eval_id": ev.id, "provider": ev.provider, "scores": ev.scores}
    finally:
        db.close()
