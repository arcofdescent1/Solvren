"use client";

type HistoricalSignal = {
  signalKey: string;
  description: string;
  strength: string;
};

export function HistoricalSignalsList({ items }: { items: HistoricalSignal[] }) {
  return (
    <div className="rounded border border-[var(--border)] p-3">
      <div className="text-sm font-semibold">Historical Signals</div>
      {items.length === 0 ? (
        <div className="mt-1 text-sm text-[var(--text-muted)]">No relevant historical patterns yet.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((s) => (
            <li key={s.signalKey} className="text-sm">
              <div className="font-medium">{s.signalKey}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.strength}</div>
              <div>{s.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
