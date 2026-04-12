"use client";

import Link from "next/link";

export function Phase4EnterpriseBanner(props: {
  phase4Status: string | null;
  cadenceReminder: boolean;
  executiveStreak: number;
  executiveTarget: number;
}) {
  const { phase4Status, cadenceReminder, executiveStreak, executiveTarget } = props;
  if (phase4Status === "COMPLETED" || phase4Status === "SKIPPED") return null;

  return (
    <div className="border-b border-[color:var(--rg-border)] bg-[color:var(--rg-surface-elevated)] px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="text-[color:var(--rg-text)]">
          <span className="font-medium">Enterprise expansion &amp; renewal readiness</span>
          {cadenceReminder
            ? ` — executive weekly cadence is below ${executiveTarget} consecutive qualifying weeks (current streak: ${executiveStreak}).`
            : " — grow footprint, deepen integrations, and reinforce renewal proof."}
        </p>
        <Link
          href="/onboarding/enterprise"
          className="shrink-0 rounded-md bg-[color:var(--rg-primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--rg-primary-fg)] hover:opacity-90"
        >
          Open expansion center
        </Link>
      </div>
    </div>
  );
}
