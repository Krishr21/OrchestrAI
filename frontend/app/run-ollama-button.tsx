'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RunOllamaButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="button"
      disabled={busy}
      onClick={async () => {
        try {
          setBusy(true);
          const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
          const res = await fetch(`${base}/ollama/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input_prompt: 'Write one short sentence about why logs are useful.',
              model: 'llama3.1:8b',
            }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          router.push(`/runs/${data.run_id}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Running Ollama…' : 'Run Ollama'}
    </button>
  );
}
