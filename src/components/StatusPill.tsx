import type { ReactNode } from "react";

type StatusPillProps = {
  tone: "success" | "warning" | "danger";
  children: ReactNode;
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
