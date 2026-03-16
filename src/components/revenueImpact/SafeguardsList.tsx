"use client";

type Safeguard = { code: string; title: string; reason: string };

export function SafeguardsList({
  title,
  items,
}: {
  title: string;
  items: Safeguard[];
}) {
  return (
    <div className="rounded border border-[var(--border)] p-3">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <div className="mt-1 text-sm text-[var(--text-muted)]">None</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((s) => (
            <li key={s.code} className="text-sm">
              <div className="font-medium">{s.title}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.code}</div>
              <div className="text-sm text-[var(--text)]">{s.reason}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
