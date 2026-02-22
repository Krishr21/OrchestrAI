import NewApiRun from '../new-api-run';

export const metadata = {
  title: 'New API run · OrchestrAI',
};

export default function ApiModelsPage() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="hero" style={{ alignItems: 'center' }}>
        <div>
          <div className="heroTitle">New API run</div>
          <div className="heroSub">Use OpenAI / Claude / Gemini via direct API calls from the backend.</div>
        </div>
      </div>
      <NewApiRun />
    </div>
  );
}
