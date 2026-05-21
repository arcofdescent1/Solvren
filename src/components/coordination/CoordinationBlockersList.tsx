"use client";

import { Badge } from "@/ui";

type Blocker = {
  code: string;
  title: string;
  description: string;
  severity: "ERROR" | "WARNING";
};

export function CoordinationBlockersList({ items }: { items: Blocker[] }) {
  if (!items.length) return <div className="text-sm text-[var(--text-muted)]">No blockers are preventing review.</div>;
  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div key={`${b.code}:${b.description}`} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{b.title}</span>
            <Badge variant={b.severity === "ERROR" ? "danger" : "warning"}>{b.severity === "ERROR" ? "Blocking" : "Warning"}</Badge>
          </div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">{b.description}</div>
        </div>
      ))}
    </div>
  );
}
