from __future__ import annotations

import asyncio
import json
from typing import Any

import redis.asyncio as redis
from fastapi import WebSocket

from app.config import settings


async def stream_run_steps(websocket: WebSocket, run_id: int) -> None:
    """Bridge Redis Pub/Sub -> WebSocket for live step updates."""
    await websocket.accept()

    r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    channel = f"orchestrai:run:{run_id}"

    await pubsub.subscribe(channel)

    try:
        # Small keepalive so proxies don't drop the socket.
        keepalive = asyncio.create_task(_keepalive(websocket))

        async for msg in pubsub.listen():
            if msg is None:
                continue
            if msg.get("type") != "message":
                continue

            data = msg.get("data")
            if isinstance(data, (bytes, bytearray)):
                data = data.decode("utf-8", errors="replace")

            # Ensure JSON object goes out even if publisher sends string.
            payload: Any
            try:
                payload = json.loads(data)
            except Exception:
                payload = {"event": "message", "data": data}

            await websocket.send_json(payload)
    except Exception:
        # Client disconnected or server shutting down.
        pass
    finally:
        try:
            keepalive.cancel()
        except Exception:
            pass
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await pubsub.close()
        except Exception:
            pass
        try:
            await r.aclose()
        except Exception:
            pass


async def _keepalive(websocket: WebSocket) -> None:
    while True:
        await asyncio.sleep(25)
        try:
            await websocket.send_json({"event": "ping"})
        except Exception:
            return
