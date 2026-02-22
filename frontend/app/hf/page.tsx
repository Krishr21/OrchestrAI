import NewHFRun from '../new-hf-run';

export const metadata = {
  title: 'New Hugging Face run · OrchestrAI',
};

export default function HFPage() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="hero" style={{ alignItems: 'center' }}>
        <div>
          <div className="heroTitle">New Hugging Face run</div>
          <div className="heroSub">Run a Hugging Face model via the local ORT service and log a full trace.</div>
        </div>
      </div>
      <NewHFRun />
    </div>
  );
}
