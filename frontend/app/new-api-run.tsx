'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = 'openai' | 'anthropic' | 'gemini';

type Preset = {
  label: string;
  provider: Provider;
  model: string;
  prompt: string;
};

const PRESETS: Preset[] = [
  {
    label: 'OpenAI (fast) — debugging one-liner',
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt: 'In one sentence, explain why replay is useful for debugging agent runs.',
  },
  {
    label: 'Claude — product critique',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    prompt: 'Give 5 concrete UI improvements for a developer observability dashboard.',
  },
  {
    label: 'Gemini — brainstorm',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    prompt: 'Brainstorm 10 features for an agent control room that helps debug tool calls.',
  },
];

export default function NewApiRun() {
  const router = useRouter();

  const [provider, setProvider] = useState<Provider>('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [prompt, setPrompt] = useState('Write one short sentence about why observability matters for AI agents.');

  const [temperature, setTemperature] = useState<number>(0.3);
  const [maxTokens, setMaxTokens] = useState<number>(256);

  const [apiKey, setApiKey] = useState('');
  const [useEnvKey, setUseEnvKey] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = useMemo(() => {
    if (busy) return false;
    if (!provider) return false;
    if (!model.trim()) return false;
    if (!prompt.trim()) return false;
    if (!useEnvKey && !apiKey.trim()) return false;
    return true;
  }, [busy, provider, model, prompt, useEnvKey, apiKey]);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const payload: any = {
        provider,
        model,
        input_prompt: prompt,
        temperature,
        max_tokens: maxTokens,
      };
      if (!useEnvKey) payload.api_key = apiKey;

      const res = await fetch(`${base}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/runs/${data.run_id}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>New API run</div>
          <div className="small" style={{ marginBottom: 10 }}>
            Use hosted providers via the backend. Keys are read from env vars by default.
          </div>

          <div className="grid2">
            <label className="field">
              <div className="label">Provider</div>
              <select
                className="input"
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  setProvider(p);
                  // small convenience defaults
                  if (p === 'openai' && model === '') setModel('gpt-4o-mini');
                  if (p === 'anthropic' && model === '') setModel('claude-3-5-sonnet-latest');
                  if (p === 'gemini' && model === '') setModel('gemini-1.5-flash');
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Google (Gemini)</option>
              </select>
            </label>

            <label className="field">
              <div className="label">Model</div>
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
              <div className="hint">Examples: gpt-4o-mini, claude-3-5-sonnet-latest, gemini-1.5-flash</div>
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
                  setProvider(p.provider);
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
              <div className="hint">Fills provider + model + prompt.</div>
            </label>

            <div className="callout">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>API key</div>
              <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useEnvKey}
                  onChange={(e) => setUseEnvKey(e.target.checked)}
                />
                Use environment key (recommended)
              </label>
              {!useEnvKey ? (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  value={apiKey}
                  placeholder="Paste API key (not stored)"
                  onChange={(e) => setApiKey(e.target.value)}
                />
              ) : (
                <div className="hint" style={{ marginTop: 8 }}>
                  Set <span className="mono">OPENAI_API_KEY</span>, <span className="mono">ANTHROPIC_API_KEY</span>, or{' '}
                  <span className="mono">GEMINI_API_KEY</span> in docker-compose.
                </div>
              )}
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <div className="label">Temperature</div>
              <input
                className="input"
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <div className="label">Max tokens</div>
              <input
                className="input"
                type="number"
                min={1}
                max={4096}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>
          </div>

          <div className="divider" />

          <label className="field" style={{ marginTop: 10 }}>
            <div className="label">Prompt</div>
            <textarea className="textarea" value={prompt} rows={7} onChange={(e) => setPrompt(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button className="button" disabled={!canRun} onClick={run}>
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
    </div>
  );
}
