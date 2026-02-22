import LiveSteps from './steps-client';
import RunActions from './run-actions';

async function getRun(id: string) {
  const base =
    process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/runs/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch run');
  return res.json();
}

function getPublicApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
}

export default async function RunPage({ params }: { params: { id: string } }) {
  const run = await getRun(params.id);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Run #{run.id}</div>
            <div className="small">{run.agent_name}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <RunActions runId={params.id} apiBase={getPublicApiBase()} />
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="kv">
          <div className="k">Status</div>
          <div>
            <span
              className={`badge ${
                run.status === 'success' ? 'ok' : run.status === 'failed' ? 'fail' : 'run'
              }`}
            >
              {run.status}
            </span>
          </div>
          <div className="k">Input</div>
          <div className="pre">{run.input_prompt}</div>
          <div className="k">Output</div>
          <div className="pre">{run.final_output || '(none)'}</div>

          <div className="k">Eval</div>
          <div className="pre">
            {run.eval_provider
              ? JSON.stringify({ provider: run.eval_provider, status: run.eval_status, scores: run.eval_scores }, null, 2)
              : '(not evaluated)'}
          </div>
        </div>
      </div>

      <LiveSteps initialSteps={run.steps} runId={run.id} />
    </div>
  );
}

