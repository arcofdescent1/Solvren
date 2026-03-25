"use client";

type Blocker = {
  code: string;
  title: string;
  description: string;
  severity: "ERROR" | "WARNING";
};

export function CoordinationBlockersList({ items }: { items: Blocker[] }) {
  if (!items.length) {
    return <div className="text-sm text-[var(--text-muted)]">No coordination blockers.</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div key={`${b.code}:${b.description}`} className="rounded border border-[var(--border)] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{b.title}</span>
            <span
              className={`text-xs rounded border px-1.5 py-0.5 ${
                b.severity === "ERROR" ? "border-red-400 text-red-700" : "border-yellow-500 text-yellow-700"
              }`}
            >
              {b.severity}
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{b.code}</div>
          <div className="text-sm mt-1">{b.description}</div>
        </div>
      ))}
    </div>
  );
}
