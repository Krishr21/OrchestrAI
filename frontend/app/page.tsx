async function getRuns() {
  // When running inside Docker, server-side fetches need to hit the backend service name.
  // Client-side/public base URL remains NEXT_PUBLIC_API_BASE_URL.
  const base =
    process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/runs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

import RunOllamaButton from './run-ollama-button';
import NewOllamaRun from './new-ollama-run';
import RunHFButton from './run-hf-button';
import NewHFRun from './new-hf-run';
import CollapsibleCard from './collapsible-card';

export default async function Page() {
  const runs = await getRuns();
  const total = runs.length;
  const success = runs.filter((r: any) => r.status === 'success').length;
  const failed = runs.filter((r: any) => r.status === 'failed').length;

  // Build a simple 14-day histogram (UTC day buckets) for a tiny home chart.
  const DAYS = 14;
  const msDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = endUtc - (DAYS - 1) * msDay;
  const buckets = Array.from({ length: DAYS }, (_, i) => ({
    dayUtc: startUtc + i * msDay,
    total: 0,
    success: 0,
    failed: 0,
  }));

  for (const r of runs) {
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const idx = Math.floor((day - startUtc) / msDay);
    if (idx < 0 || idx >= DAYS) continue;
    buckets[idx].total += 1;
    if (r.status === 'success') buckets[idx].success += 1;
    if (r.status === 'failed') buckets[idx].failed += 1;
  }

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  const sum14 = buckets.reduce(
    (acc, b) => {
      acc.total += b.total;
      acc.success += b.success;
      acc.failed += b.failed;
      return acc;
    },
    { total: 0, success: 0, failed: 0 }
  );
  const last7 = buckets.slice(-7).reduce(
    (acc, b) => {
      acc.total += b.total;
      acc.success += b.success;
      acc.failed += b.failed;
      return acc;
    },
    { total: 0, success: 0, failed: 0 }
  );
  const last7SuccessRate = last7.total > 0 ? Math.round((100 * last7.success) / last7.total) : 0;
  const peak = buckets.reduce(
    (best, b) => (b.total > best.total ? { dayUtc: b.dayUtc, total: b.total } : best),
    { dayUtc: buckets[0].dayUtc, total: buckets[0].total }
  );
  const chartBars = buckets.map((b, i) => {
    const x = i;
    const h = b.total / maxTotal;
    return { x, h, b };
  });

  return (
    <>
      <div className="hero">
        <div className="heroLeft">
          <div className="heroTitle">Agent Control Room</div>
          <div className="heroSub">
            Create runs with local models (Ollama, Hugging Face) and inspect every step in real time.
          </div>
        </div>
        <div className="heroRight">
          <RunOllamaButton />
          <RunHFButton />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="stats">
        <a className="stat statLink" href="/runs">
          <div className="statValue">{total}</div>
          <div className="statLabel">Runs loaded</div>
        </a>
        <a className="stat statLink" href="/runs?status=success">
          <div className="statValue" style={{ color: 'var(--ok)' }}>
            {success}
          </div>
          <div className="statLabel">Success</div>
        </a>
        <a className="stat statLink" href="/runs?status=failed">
          <div className="statValue" style={{ color: 'var(--danger)' }}>
            {failed}
          </div>
          <div className="statLabel">Failed</div>
        </a>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <div>
            <div className="sectionTitle">Runs over time</div>
            <div className="small">
              Last 14 days (UTC). Last 7d success rate: <span className="v">{last7SuccessRate}%</span> · Peak day:{' '}
              <span className="v">{new Date(peak.dayUtc).toISOString().slice(0, 10)}</span> ({peak.total})
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="miniStats" aria-label="14 day summary">
              <span className="miniStat">
                Total <span className="v">{sum14.total}</span>
              </span>
              <span className="miniSep">·</span>
              <span className="miniStat" style={{ color: 'var(--ok)' }}>
                Success <span className="v">{sum14.success}</span>
              </span>
              <span className="miniSep">·</span>
              <span className="miniStat" style={{ color: 'var(--danger)' }}>
                Failed <span className="v">{sum14.failed}</span>
              </span>
            </div>
            <a className="button secondary" href="/runs">
              Open runs
            </a>
          </div>
        </div>

        <a href="/runs" aria-label="Open runs" style={{ display: 'block' }}>
          <svg
            viewBox="0 0 420 120"
            width="100%"
            height="150"
            role="img"
            aria-label="Runs per day bar chart"
            style={{ display: 'block' }}
          >
            <rect x="0" y="0" width="420" height="120" rx="14" fill="rgba(255,255,255,0.02)" />

            {/* baseline */}
            <line x1="16" y1="100" x2="404" y2="100" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

            {/* y labels */}
            <text x="16" y="22" fill="rgba(255,255,255,0.45)" fontSize="10">
              {maxTotal}
            </text>
            <text x="16" y="98" fill="rgba(255,255,255,0.35)" fontSize="10">
              0
            </text>

            {/* legend */}
            <g transform="translate(250,14)">
              <rect x="0" y="0" width="154" height="24" rx="10" fill="rgba(255,255,255,0.02)" />
              <rect x="10" y="9" width="10" height="10" rx="3" fill="rgba(112, 214, 255, 0.35)" />
              <text x="26" y="18" fill="rgba(255,255,255,0.55)" fontSize="10">
                total
              </text>
              <rect x="62" y="9" width="10" height="10" rx="3" fill="rgba(61, 220, 151, 0.35)" />
              <text x="78" y="18" fill="rgba(255,255,255,0.55)" fontSize="10">
                success
              </text>
              <rect x="120" y="9" width="10" height="10" rx="3" fill="rgba(255, 93, 108, 0.28)" />
              <text x="136" y="18" fill="rgba(255,255,255,0.55)" fontSize="10">
                failed
              </text>
            </g>

            {chartBars.map(({ x, h, b }) => {
              const barW = 22;
              const gap = 6;
              const left = 16 + x * (barW + gap);
              const barH = Math.round(74 * h);
              const top = 100 - barH;
              const label = new Date(b.dayUtc).toISOString().slice(0, 10);
              const tip = `${label}: ${b.total} total • ${b.success} success • ${b.failed} failed`;
              return (
                <g key={b.dayUtc}>
                  <title>{tip}</title>
                  <rect
                    x={left}
                    y={top}
                    width={barW}
                    height={barH}
                    rx="6"
                    fill="rgba(112, 214, 255, 0.35)"
                    stroke="rgba(112, 214, 255, 0.35)"
                  />
                </g>
              );
            })}

            {/* x labels (show 3 anchor dates) */}
            <text x="16" y="114" fill="rgba(255,255,255,0.35)" fontSize="10">
              {new Date(buckets[0].dayUtc).toISOString().slice(5, 10)}
            </text>
            <text x="198" y="114" fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="middle">
              {new Date(buckets[Math.floor((DAYS - 1) / 2)].dayUtc).toISOString().slice(5, 10)}
            </text>
            <text x="404" y="114" fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="end">
              {new Date(buckets[DAYS - 1].dayUtc).toISOString().slice(5, 10)}
            </text>
          </svg>
        </a>
      </div>

      <div style={{ height: 14 }} />

      <div className="cards2">
        <CollapsibleCard
          title="New Ollama run"
          subtitle={<span className="small">Create a new run using Ollama.</span>}
          defaultOpen={false}
        >
          <NewOllamaRun noCard hideHeader />
        </CollapsibleCard>

        <CollapsibleCard
          title="New Hugging Face run"
          subtitle={<span className="small">Create a new run using hf-ort.</span>}
          defaultOpen={false}
        >
          <NewHFRun noCard hideHeader />
        </CollapsibleCard>
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div>
            <div className="sectionTitle">Recent runs</div>
            <div className="small">Jump into a run to see the live timeline, replay, and evaluation.</div>
          </div>
          <div>
            <a className="button" href="/runs" aria-label="View all runs">
              View all
            </a>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Created</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <a href={`/runs/${r.id}`}>{r.id}</a>
                </td>
                <td>{r.agent_name}</td>
                <td>
                  <span
                    className={`badge ${
                      r.status === 'success' ? 'ok' : r.status === 'failed' ? 'fail' : 'run'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td>{new Date(r.created_at).toISOString()}</td>
                <td>{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(4)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </>
  );
}
