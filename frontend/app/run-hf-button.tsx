'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RunHFButton() {
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
          const res = await fetch(`${base}/hf/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input_prompt: 'Write one sentence about why replay is helpful for debugging agents.',
              model_id: 'distilbert/distilgpt2',
              max_new_tokens: 64,
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
      {busy ? 'Running HF…' : 'Run HF (local)'}
    </button>
  );
}
