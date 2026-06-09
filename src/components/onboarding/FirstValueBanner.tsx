"use client";

/**
 * Phase 10 — First value banner (§17.3, §19.3).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type OnboardingData = {
  firstValueReached?: boolean;
  firstValueAt?: string | null;
  tracker?: { firstValueReached?: boolean; firstValueAt?: string | null };
};

export function FirstValueBanner() {
  const [data, setData] = useState<OnboardingData | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/state");
      if (res.ok) {
        const d = (await res.json()) as OnboardingData;
        setData(d);
      }
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchState();
    });
  }, [fetchState]);

  const reached = data?.tracker?.firstValueReached ?? data?.firstValueReached;
  if (!reached) return null;

  return (
    <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--success)]">First value reached!</p>
          <p className="text-xs text-[var(--text-muted)]">
            You&apos;ve achieved your first meaningful outcome. View your timeline to see recovered revenue, avoided loss, and more.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded bg-[var(--success)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          View Timeline
        </Link>
      </div>
    </div>
  );
}
