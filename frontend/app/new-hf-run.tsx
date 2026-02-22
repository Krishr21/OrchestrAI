'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type Preset = {
  label: string;
  model_id: string;
  prompt: string;
  max_new_tokens: number;
};

const PRESETS: Preset[] = [
  {
    label: 'One-liner (debugging)',
    model_id: 'distilbert/distilgpt2',
    prompt: 'Explain why replay is useful for debugging agent runs in one sentence.',
    max_new_tokens: 64,
  },
  {
    label: 'Brainstorm (tools)',
    model_id: 'distilbert/distilgpt2',
    prompt: 'List 8 ideas for features in an agent observability dashboard.',
    max_new_tokens: 128,
  },
];

export default function NewHFRun({
  noCard = false,
  hideHeader = false,
}: {
  noCard?: boolean;
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [modelId, setModelId] = useState('distilbert/distilgpt2');
  const [maxNewTokens, setMaxNewTokens] = useState(64);
  const [prompt, setPrompt] = useState('Define an agent run in one sentence.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => !busy && modelId.trim().length > 0 && prompt.trim().length > 0, [busy, modelId, prompt]);

  return (
    <div className={noCard ? '' : 'card'}>
      {!hideHeader ? (
        <>
          <div className="cardHeader">
            <div>
              <div className="cardTitle">New Hugging Face run (ORT)</div>
              <div className="cardSubtitle">
                Run a Hugging Face model via the local <span className="mono">hf-ort</span> service.
              </div>
            </div>
          </div>

          <div className="callout" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Tip</div>
            <div className="small">
              Start with a small model id (like <span className="mono">distilbert/distilgpt2</span>) and low tokens. If you
              want fully real ONNX generation, we can upgrade <span className="mono">hf-ort</span> to use Optimum + exported
              models.
            </div>
          </div>
        </>
      ) : null}

          <div className="grid2">
            <label className="field">
              <div className="label">Model ID</div>
              <input
                className="input"
                value={modelId}
                placeholder="distilbert/distilgpt2"
                onChange={(e) => setModelId(e.target.value)}
              />
              <div className="hint">Any HF model id (note: hf-ort is currently a stub engine).</div>
            </label>

            <label className="field">
              <div className="label">Max new tokens</div>
              <input
                className="input"
                type="number"
                min={1}
                max={2048}
                value={maxNewTokens}
                onChange={(e) => setMaxNewTokens(Math.max(1, Number(e.target.value || 1)))}
              />
              <div className="hint">Lower is faster; start with 64–256.</div>
            </label>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <div className="label">Preset</div>
              <select
                className="input"
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  if (Number.isNaN(idx)) return;
                  const p = PRESETS[idx];
                  setModelId(p.model_id);
                  setPrompt(p.prompt);
                  setMaxNewTokens(p.max_new_tokens);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Select a preset…
                </option>
                {PRESETS.map((p, i) => (
                  <option key={p.label} value={String(i)}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="hint">Fills model + prompt + tokens.</div>
            </label>
          </div>

          <div className="divider" />

          <label className="field" style={{ marginTop: 10 }}>
            <div className="label">Prompt</div>
            <textarea className="textarea" value={prompt} rows={6} onChange={(e) => setPrompt(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button
              className="button"
              disabled={!canRun}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
                  const res = await fetch(`${base}/hf/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      input_prompt: prompt,
                      model_id: modelId,
                      max_new_tokens: maxNewTokens,
                    }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  router.push(`/runs/${data.run_id}`);
                } catch (e: any) {
                  setError(e?.message || String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Running…' : 'Run'}
            </button>

            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setPrompt('');
                setError(null);
              }}
            >
              Clear
            </button>

            {error ? <span className="error">{error}</span> : null}
          </div>
      </div>
  );
}
