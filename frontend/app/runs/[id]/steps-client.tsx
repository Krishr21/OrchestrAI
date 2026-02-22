'use client';

import { useEffect, useState } from 'react';

export default function LiveSteps({
  initialSteps,
  runId,
}: {
  initialSteps: any[];
  runId: number;
}) {
  const [steps, setSteps] = useState<any[]>(initialSteps || []);
  const [live, setLive] = useState(false);
  const [retries, setRetries] = useState(0);

  const latencyValues = steps
    .map((s) => (typeof s.latency_ms === 'number' ? s.latency_ms : null))
    .filter((v): v is number => v !== null);
  const maxLatency = latencyValues.length ? Math.max(...latencyValues) : 0;
  const avgLatency = latencyValues.length
    ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length
    : 0;

  const countsByType = steps.reduce<Record<string, number>>((acc, s) => {
    const t = String(s.step_type || 'unknown');
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let timer: any = null;

    function wsUrl() {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (apiBase) {
        // http://host:8000 -> ws://host:8000
        return apiBase.replace(/^http/, 'ws') + `/ws/runs/${runId}`;
      }
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${window.location.hostname}:8000/ws/runs/${runId}`;
    }

    function connect(attempt: number) {
      if (stopped) return;
      try {
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          setLive(true);
          setRetries(0);
        };
        ws.onclose = () => {
          setLive(false);
          if (stopped) return;
          const nextAttempt = attempt + 1;
          setRetries(nextAttempt);
          const backoff = Math.min(8000, 250 * 2 ** Math.min(nextAttempt, 5));
          timer = setTimeout(() => connect(nextAttempt), backoff);
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg?.event === 'step' && msg?.step) {
              setSteps((prev) => {
                if (prev.some((s) => s.id === msg.step.id)) return prev;
                return [...prev, msg.step].sort((a, b) => (a.id || 0) - (b.id || 0));
              });
            }
          } catch {
            // ignore
          }
        };
      } catch {
        setLive(false);
      }
    }

    connect(0);

    return () => {
      stopped = true;
      setLive(false);
      if (timer) clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [runId]);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Steps</div>
        <div className="small">
          Live: {live ? 'connected' : 'disconnected'}
          {!live && retries > 0 ? ` (retries: ${retries})` : ''}
        </div>
      </div>

      <div className="metaGrid" style={{ marginBottom: 12 }}>
        <div className="metaStat">
          <div className="k">Steps</div>
          <div className="v">{steps.length}</div>
        </div>
        <div className="metaStat">
          <div className="k">Avg latency</div>
          <div className="v">{avgLatency ? `${Math.round(avgLatency)}ms` : '—'}</div>
        </div>
        <div className="metaStat">
          <div className="k">Max latency</div>
          <div className="v">{maxLatency ? `${Math.round(maxLatency)}ms` : '—'}</div>
        </div>
        <div className="metaStat">
          <div className="k">By type</div>
          <div className="v" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(countsByType)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([t, n]) => (
                <span key={t} className={`pill t-${t.replace(/[^a-z0-9_-]/gi, '')}`}>
                  {t}: {n}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="steps">
        {steps.map((s: any) => (
          <div key={s.id} className="step">
            <div className="stepHead">
              <div className="stepName">
                <span className={`pill t-${String(s.step_type || 'unknown').replace(/[^a-z0-9_-]/gi, '')}`}>
                  {s.step_type || 'unknown'}
                </span>
                <span style={{ marginLeft: 8 }}>
                  {s.name ? s.name : '(unnamed)'}
                </span>
              </div>
              <div className="stepMeta">
                {s.latency_ms ? `${Math.round(s.latency_ms)}ms` : ''}
              </div>
            </div>

            {typeof s.latency_ms === 'number' && maxLatency > 0 && (
              <div className="latencyBar" title={`${Math.round(s.latency_ms)}ms`}>
                <div
                  className="latencyBarFill"
                  style={{ width: `${Math.max(2, Math.round((s.latency_ms / maxLatency) * 100))}%` }}
                />
              </div>
            )}

            {(s.input || s.output || s.error_message) && (
              <div style={{ marginTop: 10 }}>
                {s.error_message && (
                  <div className="pre" style={{ color: 'var(--danger)' }}>
                    {s.error_message}
                  </div>
                )}
                {s.input && (
                  <>
                    <div className="k" style={{ marginTop: 8 }}>input</div>
                    <div className="pre">{JSON.stringify(s.input, null, 2)}</div>
                  </>
                )}
                {s.output && (
                  <>
                    <div className="k" style={{ marginTop: 8 }}>output</div>
                    <div className="pre">{JSON.stringify(s.output, null, 2)}</div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
