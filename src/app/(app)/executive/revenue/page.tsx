"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeaderV2, Card, CardBody } from "@/ui";

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

function KpiCard(props: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm font-semibold text-[var(--text-muted)]">{props.title}</p>
        <p className="mt-2 text-3xl font-bold text-[var(--text)]">{props.value}</p>
        {props.subtitle ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{props.subtitle}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

export default function ExecutiveRevenuePage() {
  const [data, setData] = useState<{
    revenueAtRisk30d?: number;
    criticalPending?: Array<{
      id: string;
      title?: string;
      riskScore?: number;
      revenueAtRisk?: number;
      revenueSurface?: string;
      slaStatus?: string;
    }>;
    overdue?: Array<{
      id: string;
      title?: string;
      dueAt?: string;
      riskScore?: number;
      revenueAtRisk?: number;
      revenueSurface?: string;
    }>;
    trend?: Array<{ day: string; revenueAtRisk?: number; count?: number }>;
    topSurfaces?: Array<{ surface: string; revenueAtRisk?: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/executive/revenue-summary");
        const json = await res.json();
        if (!res.ok)
          throw new Error(
            (json as { error?: string }).error || "Failed to load revenue summary"
          );
        if (mounted) setData(json);
      } catch (e: unknown) {
        if (mounted)
          setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const trendMax = useMemo(() => {
    const t = data?.trend ?? [];
    return t.reduce(
      (m: number, r: { revenueAtRisk?: number }) =>
        Math.max(m, r.revenueAtRisk || 0),
      0
    ) || 1;
  }, [data]);

  if (loading)
    return (
      <div className="space-y-4">
        <PageHeaderV2 breadcrumbs={[{ label: "Insights", href: "/insights" }]} title="Revenue Exposure" helper="This page aligns with the Insights narrative and may show estimated values." />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          </CardBody>
        </Card>
      </div>
    );
  if (err)
    return (
      <div className="space-y-4">
        <PageHeaderV2 breadcrumbs={[{ label: "Insights", href: "/insights" }]} title="Revenue Exposure" helper="This page aligns with the Insights narrative and may show estimated values." />
        <Card className="border-[var(--danger)]/50">
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{err}</p>
          </CardBody>
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeaderV2
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "Revenue Exposure" },
        ]}
        title="Revenue Exposure"
        description="Business impact, revenue exposure, and trend lines across recent change activity."
        helper="Use this view to understand concentration and trajectory of exposure with explicit time-window framing."
        actions={
          <Link href="/insights" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Insights
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          title="Revenue at Risk (30d)"
          value={fmtMoney(data?.revenueAtRisk30d ?? 0)}
          subtitle="Pending changes only"
        />
        <KpiCard
          title="Critical pending"
          value={String((data?.criticalPending ?? []).length)}
          subtitle="Risk ≥ 75"
        />
        <KpiCard
          title="Overdue"
          value={String((data?.overdue ?? []).length)}
          subtitle="SLA OVERDUE"
        />
      </div>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Exposure trend</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Daily revenue-at-risk (last 30 days).
          </p>
          <div className="mt-4 space-y-2">
          {(data?.trend ?? []).map((r) => (
            <div key={r.day} className="flex items-center gap-3">
              <div className="w-24 text-xs text-[var(--text-muted)]">{r.day}</div>
              <div className="flex-1 rounded-full bg-[var(--bg-surface-2)]">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{
                    width: `${Math.round(
                      ((r.revenueAtRisk ?? 0) / trendMax) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="w-28 text-right text-xs font-semibold">
                {fmtMoney(r.revenueAtRisk ?? 0)}
              </div>
            </div>
          ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Top revenue surfaces</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Where revenue exposure is concentrated.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(data?.topSurfaces ?? []).map((s) => (
            <div key={s.surface} className="rounded-[var(--radius-sb)] border border-[var(--border)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s.surface}</div>
                <div className="text-sm font-semibold">
                  {fmtMoney(s.revenueAtRisk ?? 0)}
                </div>
              </div>
            </div>
          ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Critical pending changes</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sorted by estimated revenue at risk.
          </p>
          <div className="mt-3 space-y-2">
          {(data?.criticalPending ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/changes/${c.id}`}
              className="block rounded-[var(--radius-sb)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:bg-[var(--bg-surface-2)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {c.title || "Untitled change"}
                  </div>
                  <div className="text-xs text-neutral-600">
                    Surface: {c.revenueSurface ?? "—"} · Risk:{" "}
                    {Math.round(c.riskScore ?? 0)} · SLA: {c.slaStatus ?? "—"}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {fmtMoney(c.revenueAtRisk ?? 0)}
                </div>
              </div>
            </Link>
          ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Overdue revenue changes</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Operational urgency with financial context.
          </p>
          <div className="mt-3 space-y-2">
          {(data?.overdue ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/changes/${c.id}`}
              className="block rounded-[var(--radius-sb)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:bg-[var(--bg-surface-2)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {c.title || "Untitled change"}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Due:{" "}
                    {c.dueAt
                      ? new Date(c.dueAt).toLocaleString()
                      : "—"}{" "}
                    · Risk: {Math.round(c.riskScore ?? 0)} · Surface:{" "}
                    {c.revenueSurface ?? "—"}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {fmtMoney(c.revenueAtRisk ?? 0)}
                </div>
              </div>
            </Link>
          ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
