import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'OrchestrAI',
  description: 'Agent Control Room',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="appShell">
          <aside className="sidebar">
            <div className="sidebarBrand">
              <a className="sidebarBrandLink" href="/">
                OrchestrAI
              </a>
              <div className="sidebarTag">Control Room</div>
            </div>

            <nav className="sidebarNav" aria-label="Primary">
              <a className="sidebarLink" href="/runs">
                Runs
              </a>
              <a className="sidebarLink" href="/ollama">
                New Ollama run
              </a>
              <a className="sidebarLink" href="/hf">
                New Hugging Face run
              </a>
              <a className="sidebarLink" href="/api-models">
                New API run
              </a>
            </nav>

            <div className="sidebarFoot">
              <div className="small">
                Local-first. Stream steps, replay runs, evaluate outputs.
              </div>
            </div>
          </aside>

          <div className="content">
            <div className="container">
              <main className="main">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
