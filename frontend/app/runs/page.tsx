async function getRuns() {
  const base =
    process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/runs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

import RunsList from './runs-list';

export const metadata = {
  title: 'Runs · OrchestrAI',
};

export default async function RunsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const runs = await getRuns();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const status = (searchParams?.status || 'all') as any;
  return <RunsList initialRuns={runs} apiBase={apiBase} initialStatus={status} />;
}
