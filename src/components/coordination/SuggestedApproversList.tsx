"use client";

import { Badge } from "@/ui";

type SuggestedApprover = {
  userId: string;
  displayName: string;
  role: string;
  source: string;
  required: boolean;
  reason: string;
};

export function SuggestedApproversList({ items }: { items: SuggestedApprover[] }) {
  if (!items.length) {
    return <div className="text-sm text-[var(--text-muted)]">No approver suggestions.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={`${a.userId}:${a.role}`} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.displayName}</span>
            <span className="text-xs text-[var(--text-muted)]">{a.role}</span>
            <Badge variant="outline">{a.source}</Badge>
            {a.required ? <Badge variant="warning">Required</Badge> : null}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{a.reason}</div>
        </div>
      ))}
    </div>
  );
}
