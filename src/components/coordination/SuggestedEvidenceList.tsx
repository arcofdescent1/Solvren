"use client";

import { Badge } from "@/ui";

type EvidenceItem = {
  kind: string;
  title: string;
  reason: string;
  source: string;
};

export function SuggestedEvidenceList({ title, items }: { title: string; items: EvidenceItem[] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-sm text-[var(--text-muted)]">None</div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((e) => (
            <div key={`${e.kind}:${e.title}`} className="text-sm">
              <div className="font-medium">{e.title}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="outline">{e.kind}</Badge>
                <Badge variant="secondary">{e.source}</Badge>
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
