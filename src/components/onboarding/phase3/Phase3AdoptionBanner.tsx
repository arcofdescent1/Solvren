"use client";

import Link from "next/link";

export function Phase3AdoptionBanner(props: { phase3Status: string | null; eligible: boolean }) {
  const { phase3Status, eligible } = props;
  if (phase3Status === "COMPLETED" || phase3Status === "SKIPPED") return null;

  return (
    <div className="border-b border-[color:var(--rg-border)] bg-[color:var(--rg-surface-elevated)] px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="text-[color:var(--rg-text)]">
          <span className="font-medium">Adoption &amp; Executive Value</span>
          {!eligible ? " — unlocks after Phase 2 activity thresholds (or 7 days since activation)." : " — embed Solvren across teams and leadership cadence."}
        </p>
        <Link
          href="/onboarding/adoption"
          className="shrink-0 rounded-md bg-[color:var(--rg-primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--rg-primary-fg)] hover:opacity-90"
        >
          Continue adoption
        </Link>
      </div>
    </div>
  );
}
