"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, EmptyState, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { MetricHelpTooltip, PageHelpDrawer } from "@/components/help";

type RevenueSummary = {
  criticalPending?: Array<{ id: string; title?: string; revenueSurface?: string; revenueAtRisk?: number }>;
  overdue?: Array<{ id: string; title?: string; revenueSurface?: string; revenueAtRisk?: number }>;
  topSurfaces?: Array<{ surface: string; revenueAtRisk: number }>;
};

type ExecutiveSummary = {
  topDrivers?: Array<{ signalKey: string; count: number }>;
};

type BySystemResponse = {
  bySystem?: Array<{ systemKey: string; issueCount: number; revenueAtRisk: number }>;
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    n
  );
}

const TAXONOMY = [
  "Billing",
  "Checkout",
  "Subscription / renewals",
  "Pricing / promotions",
  "Entitlements / access",
  "Integrations",
  "Review / approval gaps",
  "Monitoring / coverage gaps",
] as const;

function classify(surface: string) {
  const s = surface.toLowerCase();
  if (s.includes("billing")) return "Billing";
  if (s.includes("checkout")) return "Checkout";
  if (s.includes("renew") || s.includes("subscription")) return "Subscription / renewals";
  if (s.includes("pricing") || s.includes("promo")) return "Pricing / promotions";
  if (s.includes("entitlement") || s.includes("access")) return "Entitlements / access";
  if (s.includes("integration")) return "Integrations";
  if (s.includes("approval") || s.includes("review")) return "Review / approval gaps";
  return "Monitoring / coverage gaps";
}

export default function ExecutiveImpactPage() {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null);
  const [bySystem, setBySystem] = useState<BySystemResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [revRes, execRes, bySystemRes] = await Promise.all([
          fetch("/api/executive/revenue-summary"),
          fetch("/api/executive/summary?range=30d"),
          fetch("/api/reporting/impact/by-system"),
        ]);
        const revJson = (await revRes.json().catch(() => ({}))) as RevenueSummary;
        const execJson = (await execRes.json().catch(() => ({}))) as ExecutiveSummary;
        const sysJson = (await bySystemRes.json().catch(() => ({}))) as BySystemResponse;
        if (mounted) {
          setData(revJson);
          setExecutive(execJson);
          setBySystem(sysJson);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    const map = new Map<string, { contribution: number; count: number }>();
    for (const key of TAXONOMY) map.set(key, { contribution: 0, count: 0 });

    for (const surface of data?.topSurfaces ?? []) {
      const bucket = classify(surface.surface ?? "monitoring");
      const cur = map.get(bucket)!;
      cur.contribution += Number(surface.revenueAtRisk ?? 0);
      map.set(bucket, cur);
    }

    for (const sys of bySystem?.bySystem ?? []) {
      const bucket = classify(sys.systemKey ?? "monitoring");
      const cur = map.get(bucket)!;
      cur.contribution += Number(sys.revenueAtRisk ?? 0);
      cur.count += Number(sys.issueCount ?? 0);
      map.set(bucket, cur);
    }

    for (const d of executive?.topDrivers ?? []) {
      const bucket = classify(d.signalKey ?? "monitoring");
      const cur = map.get(bucket)!;
      cur.count += Number(d.count ?? 0);
      map.set(bucket, cur);
    }

    return TAXONOMY.map((label) => {
      const val = map.get(label)!;
      const href =
        label === "Integrations" || label === "Monitoring / coverage gaps"
          ? "/integrations"
          : label === "Review / approval gaps"
          ? "/settings/policies"
          : label === "Billing" || label === "Checkout" || label === "Pricing / promotions"
          ? "/changes?view=all&impact=high"
          : "/issues?severity=high";
      return { label, contribution: val.contribution, count: val.count, href };
    })
      .filter((r) => r.count > 0 || r.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution);
  }, [data, executive, bySystem]);

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: "Risk Drivers" }]}
        title="Top risk drivers"
        description="See what is causing exposure, which drivers are worsening, and where to act now."
        helper="Driver categories are normalized so leaders can compare trends consistently over time."
        helpTrigger={<PageHelpDrawer page="risk_drivers" />}
      />

      {loading ? (
        <Card><CardBody><p className="text-sm text-[var(--text-muted)]">Loading risk drivers...</p></CardBody></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="still_building"
          title="Exposure data is still building"
          body="As Solvren monitors more systems and changes, risk driver breakdown becomes more accurate."
        />
      ) : (
        <>
          <Grid cols={3} gap={4}>
            <Card><CardBody><p className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1">Driver categories <MetricHelpTooltip metricKey="detection_coverage" page="risk_drivers" section="summary" /></p><p className="text-2xl font-semibold">{rows.length}</p></CardBody></Card>
            <Card><CardBody><p className="text-xs text-[var(--text-muted)]">Most concentrated driver</p><p className="text-2xl font-semibold">{rows[0]?.label ?? "—"}</p></CardBody></Card>
            <Card><CardBody><p className="text-xs text-[var(--text-muted)]">Driver-linked work items</p><p className="text-2xl font-semibold">{rows.reduce((a, b) => a + b.count, 0)}</p></CardBody></Card>
          </Grid>

          <Card>
            <CardBody>
              <SectionHeader title="Driver breakdown" helper="Click any driver to jump directly to the operational surface where action happens." />
              <div className="mt-3 space-y-2">
                {rows.map((r) => (
                  <Link key={r.label} href={r.href} className="block rounded-md border p-3 hover:bg-[var(--table-row-hover)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{r.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{r.count} linked items</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fmtMoney(r.contribution)}</p>
                        <p className="text-xs text-[var(--text-muted)]">{r.count >= 3 ? "trend up" : "stable"}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

        </>
      )}
      <Card>
        <CardBody>
          <SectionHeader title="Direct action routes" helper="Go from driver to execution without extra insights hops." />
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link href="/issues?severity=high" className="font-semibold text-[var(--primary)] hover:underline">Open high-severity issues</Link>
            <Link href="/changes?view=all&impact=high" className="font-semibold text-[var(--primary)] hover:underline">Open high-impact changes</Link>
            <Link href="/integrations" className="font-semibold text-[var(--primary)] hover:underline">Improve integration coverage</Link>
            <Link href="/settings/policies" className="font-semibold text-[var(--primary)] hover:underline">Improve approval coverage</Link>
          </div>
        </CardBody>
      </Card>
    </Stack>
  );
}
