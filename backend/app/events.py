from __future__ import annotations

import json
from typing import Any

import redis

from app.config import settings


def _redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def publish_step(run_id: int, step: dict[str, Any]) -> None:
    # Pub/Sub channel: orchestrai:run:<id>
    r = _redis_client()
    r.publish(f"orchestrai:run:{run_id}", json.dumps(step, default=str))
