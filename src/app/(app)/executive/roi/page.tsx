"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, CardBody } from "@/ui";

function fmtMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type ROIData = {
  totalRecovered?: number;
  totalAvoided?: number;
  totalSavings?: number;
  totalValue?: number;
  totalCost?: number;
  roiMultiple?: number | null;
  outcomeCount?: number;
  trend?: Array<{
    day: string;
    recovered?: number;
    avoided?: number;
    savings?: number;
    total?: number;
  }>;
};

export default function ExecutiveROIPage() {
  const [data, setData] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/outcomes/roi?since=30");
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load ROI");
        if (mounted) setData(json);
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const trendMax = (data?.trend ?? []).reduce((m, r) => Math.max(m, r.total ?? 0), 0) || 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: "ROI" }]} title="ROI" />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: "ROI" }]} title="ROI" />
        <Card className="border-[var(--danger)]/50">
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{err}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "ROI" },
        ]}
        title="ROI"
        description="Verified outcomes and measurable value from resolved issues and governed changes."
        right={
          <Link href="/insights" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Insights
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Recovered Revenue</p>
            <p className="mt-2 text-2xl font-bold text-[var(--success)]">{fmtMoney(data?.totalRecovered ?? 0)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Verified recovered</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Avoided Loss</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{fmtMoney(data?.totalAvoided ?? 0)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Churn prevented</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Operational Savings</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{fmtMoney(data?.totalSavings ?? 0)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Cost savings</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-[var(--text-muted)]">ROI Multiple</p>
            <p className="mt-2 text-2xl font-bold text-[var(--primary)]">
              {data?.roiMultiple != null ? `${data.roiMultiple}x` : "—"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              (Recovered + Avoided + Savings) / Cost
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Outcome trend (30d)</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Daily verified value by type.</p>
          <div className="mt-4 space-y-2">
            {(data?.trend ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No outcomes yet. Execute actions on issues to see verified value.</p>
            ) : (
              (data?.trend ?? []).map((r) => (
                <div key={r.day} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-[var(--text-muted)]">{r.day}</div>
                  <div className="flex-1 rounded-full bg-[var(--bg-surface-2)]">
                    <div
                      className="h-2 rounded-full bg-[var(--success)]"
                      style={{ width: `${Math.round(((r.total ?? 0) / trendMax) * 100)}%` }}
                    />
                  </div>
                  <div className="w-28 text-right text-xs font-semibold">{fmtMoney(r.total ?? 0)}</div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Total value</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {data?.outcomeCount ?? 0} verified outcomes in the last 30 days.
          </p>
          <p className="mt-3 text-3xl font-bold text-[var(--primary)]">{fmtMoney(data?.totalValue ?? 0)}</p>
        </CardBody>
      </Card>
    </div>
  );
}
