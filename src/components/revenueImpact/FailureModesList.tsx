"use client";

type FailureMode = {
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  signals: string[];
};

export function FailureModesList({ items }: { items: FailureMode[] }) {
  if (!items.length) {
    return <div className="text-sm text-[var(--text-muted)]">No failure modes identified.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((m, idx) => (
        <div key={`${m.title}-${idx}`} className="rounded border border-[var(--border)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{m.title}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {m.severity} • {m.likelihood}
            </div>
          </div>
          <div className="mt-1 text-sm text-[var(--text)]">{m.description}</div>
          {m.signals.length > 0 ? (
            <div className="mt-2 text-xs text-[var(--text-muted)]">Signals: {m.signals.join(", ")}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
