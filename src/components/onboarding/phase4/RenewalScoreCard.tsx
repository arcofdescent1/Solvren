"use client";

export function RenewalScoreCard(props: { score: number }) {
  return (
    <div className="rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--rg-text-muted)]">Renewal score</p>
      <p className="mt-1 text-3xl font-semibold text-[color:var(--rg-text)]">{props.score}</p>
      <p className="mt-2 text-xs text-[color:var(--rg-text-muted)]">
        Recomputed on sync from departments, value stories, executive streak, weekly usage, and integration depth.
      </p>
    </div>
  );
}
