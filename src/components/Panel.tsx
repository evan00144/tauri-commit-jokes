import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, subtitle, aside, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
