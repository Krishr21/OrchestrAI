import NewOllamaRun from '../new-ollama-run';

export const metadata = {
  title: 'New Ollama run · OrchestrAI',
};

export default function OllamaPage() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="hero" style={{ alignItems: 'center' }}>
        <div>
          <div className="heroTitle">New Ollama run</div>
          <div className="heroSub">Run a local Ollama model and capture every step.</div>
        </div>
      </div>
      <NewOllamaRun />
    </div>
  );
}
