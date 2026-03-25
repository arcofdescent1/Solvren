"use client";

type EvidenceItem = {
  kind: string;
  title: string;
  reason: string;
  source: string;
};

export function SuggestedEvidenceList({
  title,
  items,
}: {
  title: string;
  items: EvidenceItem[];
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-white p-3 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] mt-1">None</div>
      ) : (
        <div className="space-y-2 mt-2">
          {items.map((e) => (
            <div key={e.kind} className="text-sm">
              <div className="font-medium">{e.title}</div>
              <div className="text-xs text-[var(--text-muted)]">{e.kind} • {e.source}</div>
              <div className="text-xs">{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
