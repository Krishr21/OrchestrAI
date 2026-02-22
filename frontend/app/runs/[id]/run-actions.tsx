'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  runId: string;
  apiBase: string;
};

async function postJson(url: string) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export default function RunActions({ runId, apiBase }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'evaluate' | 'replay'>(null);
  const disabled = busy !== null;

  async function refreshSoon() {
    router.refresh();
    // Celery runs async; a short delayed refresh makes the updated eval snapshot show up reliably.
    setTimeout(() => router.refresh(), 800);
  }

  async function waitForRunUpdate(
    previousUpdatedAt: string | null,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ) {
    const timeoutMs = opts?.timeoutMs ?? 8000;
    const intervalMs = opts?.intervalMs ?? 600;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      try {
        const res = await fetch(`${apiBase}/runs/${runId}`, { cache: 'no-store' });
        if (res.ok) {
          const run = await res.json();
          const nextUpdatedAt = run?.updated_at ?? null;
          // If this run was already evaluated, the snapshot won't change shape;
          // waiting for updated_at ensures we refresh once the worker writes.
          if (previousUpdatedAt && nextUpdatedAt && nextUpdatedAt !== previousUpdatedAt) return;
          if (!previousUpdatedAt && nextUpdatedAt) return;
        }
      } catch {
        // ignore transient errors while polling
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return (
    <>
      <button
        className="button"
        type="button"
        disabled={disabled}
        onClick={async () => {
          try {
            setBusy('evaluate');
            console.log('[orchestrai] evaluate start', { runId, apiBase });

            // Capture current updated_at so we can detect when the worker persisted new eval.
            let previousUpdatedAt: string | null = null;
            try {
              const res = await fetch(`${apiBase}/runs/${runId}`, { cache: 'no-store' });
              if (res.ok) {
                const run = await res.json();
                previousUpdatedAt = run?.updated_at ?? null;
              }
            } catch {
              previousUpdatedAt = null;
            }

            await postJson(`${apiBase}/runs/${runId}/evaluate`);
            // Poll until the worker writes the snapshot so the user doesn't need to refresh manually.
            await waitForRunUpdate(previousUpdatedAt);
            await refreshSoon();
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === 'evaluate' ? 'Evaluating…' : 'Evaluate'}
      </button>

      <button
        className="button"
        type="button"
        disabled={disabled}
        onClick={async () => {
          try {
            setBusy('replay');
            console.log('[orchestrai] replay start', { runId, apiBase });
            await postJson(`${apiBase}/runs/${runId}/replay`);
            alert('Replay started.');
            await refreshSoon();
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === 'replay' ? 'Replaying…' : 'Replay'}
      </button>
    </>
  );
}
