'use client';

import { ReactNode, useId, useState } from 'react';

type Props = {
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
};

export default function CollapsibleCard({
  title,
  subtitle,
  defaultOpen = true,
  right,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="card">
      <div className="collapsibleHead">
        <button
          type="button"
          className="collapsibleToggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="chev" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span>
            <span className="collapsibleTitle">{title}</span>
            {subtitle ? <span className="collapsibleSub">{subtitle}</span> : null}
          </span>
        </button>

        {right ? <div className="collapsibleRight">{right}</div> : null}
      </div>

      <div id={contentId} className={open ? 'collapsibleBody' : 'collapsibleBody hidden'}>
        {children}
      </div>
    </div>
  );
}
