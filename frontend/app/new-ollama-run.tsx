'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

type Preset = {
  label: string;
  model: string;
  prompt: string;
};

const PRESETS: Preset[] = [
  {
    label: 'Summarize (short)',
    model: 'llama3.1:8b',
    prompt: 'Summarize the following in 3 bullet points:\n\n<text>Paste text here</text>',
  },
  {
    label: 'Brainstorm',
    model: 'llama3.1:8b',
    prompt: 'Brainstorm 10 ideas for a developer tool that improves debugging agent runs.',
  },
  {
    label: 'Code review helper',
    model: 'llama3.1:8b',
    prompt:
      'You are a strict code reviewer. Review the following diff and list issues + improvements:\n\n<diff>...</diff>',
  },
];

export default function NewOllamaRun({
  noCard = false,
  hideHeader = false,
}: {
  noCard?: boolean;
  hideHeader?: boolean;
}) {
  const router = useRouter();

  const [model, setModel] = useState('llama3.1:8b');
  const [prompt, setPrompt] = useState(
    'Write one short sentence about why observability matters for AI agents.'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => {
    return model.trim().length > 0 && prompt.trim().length > 0 && !busy;
  }, [model, prompt, busy]);

  return (
    <div className={noCard ? '' : 'card'}>
      <div>
        {!hideHeader ? (
          <>
            <div className="cardHeader">
              <div>
                <div className="cardTitle">New Ollama run</div>
                <div className="cardSubtitle">Pick a model and prompt, then run it.</div>
              </div>
            </div>

            <div className="callout" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Tip</div>
              <div className="small">
                If you hit “model not found”, run <span className="mono">ollama pull &lt;model&gt;</span> once on your host.
              </div>
            </div>
          </>
        ) : null}

          <div className="grid2">
            <label className="field">
              <div className="label">Model</div>
              <input
                className="input"
                value={model}
                placeholder="llama3.1:8b"
                onChange={(e) => setModel(e.target.value)}
              />
              <div className="hint">Any model installed in Ollama (e.g., llama3.2, mistral, qwen2.5).</div>
            </label>

            <label className="field">
              <div className="label">Prompt presets</div>
              <select
                className="input"
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  if (Number.isNaN(idx)) return;
                  const p = PRESETS[idx];
                  setModel(p.model);
                  setPrompt(p.prompt);
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
              <div className="hint">Fast way to try different prompts.</div>
            </label>
          </div>

          <div className="divider" />

          <label className="field" style={{ marginTop: 10 }}>
            <div className="label">Prompt</div>
            <textarea
              className="textarea"
              value={prompt}
              rows={6}
              onChange={(e) => setPrompt(e.target.value)}
            />
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
                  const res = await fetch(`${base}/ollama/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input_prompt: prompt, model }),
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
    </div>
  );
}
