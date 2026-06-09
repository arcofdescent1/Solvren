"use client";

export function RenewalScoreCard(props: { score: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Renewal score</p>
      <p className="mt-1 text-3xl font-semibold text-[var(--text)]">{props.score}</p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Recomputed on sync from departments, value stories, executive streak, weekly usage, and integration depth.
      </p>
    </div>
  );
}
