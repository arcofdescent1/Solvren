"use client";

/** Simple bar sparkline for outcome trends (placeholder until metrics history API exists). */
export function OutcomeMetricChart({ values }: { values: number[] }) {
  if (!values.length) return <p className="text-sm text-[var(--text-muted)]">No trend data.</p>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="min-w-[6px] flex-1 rounded-sm bg-[var(--primary)]/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}
