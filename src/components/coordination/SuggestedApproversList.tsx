"use client";

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
        <div key={`${a.userId}:${a.role}`} className="rounded border border-[var(--border)] bg-white p-2 shadow-sm text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.displayName}</span>
            <span className="text-xs text-[var(--text-muted)]">{a.role}</span>
            <span className="text-xs rounded border px-1.5 py-0.5">{a.source}</span>
            {a.required ? <span className="text-xs rounded border px-1.5 py-0.5">required</span> : null}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{a.reason}</div>
        </div>
      ))}
    </div>
  );
}
