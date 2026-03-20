"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type Briefing = {
  mode: "risk" | "empty" | "demo";
  topRiskId: string | null;
  headline: string;
  summary: string;
  estimatedExposure: number;
  source: string;
  recommendedAction: string;
  monitoring?: string[];
};

export function RevenueRiskBriefingPanel({ orgId }: { orgId: string | null }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      queueMicrotask(() => {
        setBriefing({
          mode: "demo",
          topRiskId: null,
          headline: "Example risk detected (demo)",
          summary: "Connect an organization to see real revenue risks.",
          estimatedExposure: 275000,
          source: "-",
          recommendedAction: "Create or join an organization to get started.",
        });
        setLoading(false);
      });
      return;
    }
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2000);
    fetch("/api/ai/risk-briefing", { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setBriefing(j as Briefing))
      .catch(() =>
        setBriefing({
          mode: "empty",
          topRiskId: null,
          headline: "Revenue Risk Briefing",
          summary: "Unable to load briefing.",
          estimatedExposure: 0,
          source: "-",
          recommendedAction: "Refresh the page.",
        })
      )
      .finally(() => {
        clearTimeout(t);
        setLoading(false);
      });
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [orgId]);

  if (loading) {
    return (
      <Card className="border-[var(--primary)]/30">
        <CardBody className="py-6">
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--border)]" />
          <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-[var(--border)]" />
        </CardBody>
      </Card>
    );
  }
  if (!briefing) return null;

  const isDemo = briefing.mode === "demo";
  const isEmpty = briefing.mode === "empty";
  const hasRisk = briefing.mode === "risk" && briefing.topRiskId;
  const fmt = (n: number) =>
    Number.isFinite(n) && n > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
      : null;

  return (
    <Card
      className={
        isDemo ? "border-amber-500/40 bg-amber-500/5" : hasRisk ? "border-[var(--primary)]/40 bg-[var(--primary)]/5" : "border-[var(--border)]"
      }
    >
      <CardBody className="py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Revenue Risk Briefing</p>
        {isDemo && <p className="mt-1 text-xs font-medium text-amber-600">Demo Monitoring Mode</p>}
        <h2 className="mt-2 text-xl font-bold text-[var(--text)]">{briefing.headline}</h2>
        <p className="mt-2 text-sm text-[var(--text)]">{briefing.summary}</p>
        {!isEmpty && briefing.estimatedExposure > 0 && (
          <div className="mt-3 inline-flex items-center rounded-lg bg-[var(--primary)]/15 px-3 py-1.5">
            <span className="text-xs text-[var(--text-muted)]">Estimated exposure</span>
            <span className="ml-2 text-lg font-bold text-[var(--primary)]">{fmt(briefing.estimatedExposure) ?? "-"}</span>
          </div>
        )}
        {briefing.source !== "-" && <p className="mt-2 text-xs text-[var(--text-muted)]">Source: {briefing.source}</p>}
        <p className="mt-2 text-sm font-medium text-[var(--primary)]">{briefing.recommendedAction}</p>
        {isEmpty && briefing.monitoring?.length ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">Solvren is actively monitoring: {briefing.monitoring.join(", ")}.</p>
        ) : null}
        {hasRisk && briefing.topRiskId ? (
          <Link
            href={`/risk/event/${briefing.topRiskId}`}
            className="mt-4 inline-block rounded-md border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20"
          >
            View risk details
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
}
