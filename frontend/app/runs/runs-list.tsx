'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  initialRuns: any[];
  apiBase: string;
  initialStatus?: 'all' | 'success' | 'failed' | 'running';
};

function formatLocal(dt: string) {
  try {
    return new Date(dt).toISOString();
  } catch {
    return dt;
  }
}

export default function RunsList({ initialRuns, apiBase, initialStatus = 'all' }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'success' | 'failed' | 'running'>(initialStatus);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initialRuns.filter((r) => {
      const statusOk = status === 'all' ? true : r.status === status;
      if (!statusOk) return false;
      if (!query) return true;
      const hay = `${r.id} ${r.agent_name ?? ''} ${r.input_prompt ?? ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [initialRuns, q, status]);

  async function deleteRun(runId: number) {
    const ok = confirm(`Delete run #${runId}? This will also delete its steps/evals.`);
    if (!ok) return;

    setBusyId(runId);
    setErr(null);
    try {
      const res = await fetch(`${apiBase}/runs/${runId}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Delete failed: ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="hero" style={{ alignItems: 'center' }}>
        <div>
          <div className="heroTitle">Runs</div>
          <div className="heroSub">Filter, inspect, and delete runs.</div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="grid2">
          <div className="field">
            <div className="label">Search</div>
            <input
              className="input"
              value={q}
              placeholder="Search by id, agent name, or prompt…"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="label">Status</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>
          </div>
        </div>

        {err ? <div className="error">{err}</div> : null}

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>ID</th>
              <th>Agent</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 210 }}>Created</th>
              <th style={{ width: 110 }}>Cost</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
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
                <td>{formatLocal(r.created_at)}</td>
                <td className="v">${Number(r.total_cost_usd || 0).toFixed(4)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="button"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => deleteRun(r.id)}
                    style={{ borderColor: 'color-mix(in oklab, var(--danger) 35%, var(--border))' }}
                    title="Delete run"
                  >
                    {busyId === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="small" style={{ padding: 14 }}>
                  No runs match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
