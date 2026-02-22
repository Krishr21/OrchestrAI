# OrchestrAI (MVP)

An **Agent Control Room** you can run locally for free:

- Records every agent run step-by-step (prompt, steps, tool calls, errors, latency)
- Stores runs + steps in Postgres
- Streams live step events via Redis Pub/Sub + WebSockets
- Asynchronous evaluation pipeline via Celery (free/local stub by default)
- OpenTelemetry tracing (console exporter by default; optional OTLP)
- Next.js dashboard (dark-mode-first)

Model runners included:

- **Ollama** (local)
- **Hugging Face ORT service** (local `hf-ort` sidecar)
- **Hosted APIs** (optional): OpenAI / Anthropic / Gemini

Repo: https://github.com/Krishr21/OrchestrAI

## Quick start (Docker)

```zsh
docker compose up --build
```

Then:
- API: `http://localhost:8000`
- Dashboard: `http://localhost:3000`

Create a sample run (API):

```zsh
curl -X POST http://localhost:8000/demo/run
```

Health check:

```zsh
curl http://localhost:8000/health
```

Open the dashboard and click into the run to see its steps, replays, and evaluation.

Alternatively, use the dashboard home page “New Ollama run” / “New Hugging Face run” sections to create a run.

## Live updates (WebSockets)

The run detail page subscribes to live step events via WebSockets:

- `ws://localhost:8000/ws/runs/{run_id}`

When a new step is appended (or a run is created), the backend publishes a JSON message to Redis and relays it to connected browsers.

## Quality checks (free/offline)

Click **Evaluate** on a run to enqueue an offline evaluation job via Celery.
Results are persisted to Postgres and the latest snapshot is shown on the run detail page.

## Replay engine

Replays use a pluggable executor registry. `demo-agent` replays re-execute a deterministic demo agent.
Unknown agents fall back to cloning prior steps into a new replay run.

## Configuration

### Ollama

- `OLLAMA_BASE_URL` (default: `http://ollama:11434` in Docker)
- `OLLAMA_MODEL` (example: `llama3.1:8b`)

### HF ORT service

- `HF_ORT_BASE_URL` (default: `http://hf-ort:9000` in Docker)

### Hosted APIs (optional)

Set one or more keys to enable the `/api/run` endpoint and the “New API run” UI:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

Tip: copy `.env.example` to `.env` if you want to keep keys out of source control.

## Notes

- Database schema is versioned with Alembic and migrations are applied on API startup.
- Quality checks are intentionally free/local: the Celery evaluation task returns a stub payload.
- To export traces to a collector, set `OTEL_EXPORTER_OTLP_ENDPOINT` (OTLP/HTTP) in `docker-compose.yml`.

## Troubleshooting

- **Frontend changes not showing up?** This project runs the Next.js dev server inside Docker without bind mounts. Rebuild the frontend service:

	```zsh
	docker compose up -d --build frontend
	```

