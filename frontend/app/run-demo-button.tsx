'use client';

import { useState } from 'react';

export default function RunDemoButton() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${base}/demo/run`, { method: 'POST' });
      const data = await res.json();
      if (data?.run_id) {
        window.location.href = `/runs/${data.run_id}`;
      } else {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Quick actions</div>
          <div className="small">Generate a sample run and jump straight into the timeline.</div>
        </div>
        <button className="button" onClick={onClick} disabled={loading}>
          {loading ? 'Running…' : 'Run demo'}
        </button>
      </div>
    </div>
  );
}
