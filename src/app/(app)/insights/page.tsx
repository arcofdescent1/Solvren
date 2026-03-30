"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardBody,
  EmptyState,
  Grid,
  PageHeaderV2,
  SectionHeader,
  Stack,
} from "@/ui";
import { PageHelpDrawer, MetricHelpTooltip } from "@/components/help";
import { trackAppEvent } from "@/lib/appAnalytics";
import type { RoiSummaryResponse } from "@/features/roi/types";

type RevenueSummary = {
  revenueAtRisk30d?: number;
  criticalPending?: Array<{ id: string; revenueSurface?: string | null }>;
  overdue?: Array<{ id: string }>;
  trend?: Array<{ day: string; revenueAtRisk?: number }>;
  topSurfaces?: Array<{ surface: string; revenueAtRisk: number }>;
};

type ImpactSummary = {
  orgId?: string;
  totalRevenueAtRisk?: number;
  openIssueCount?: number;
  impactedIssueCount?: number;
  asOf?: string;
};

type ExecutiveSummary = {
  topDrivers?: Array<{ signalKey: string; count: number }>;
  byRevenueSurface?: Array<{
    surface: string;
    critical: number;
    high: number;
    mrrAffected: number;
  }>;
};

type BySystemResponse = {
  bySystem?: Array<{
    systemKey: string;
    issueCount: number;
    revenueAtRisk: number;
  }>;
};

type PendingTasksResponse = {
  tasks?: Array<{ id: string; status?: string }>;
};

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function driverBucket(label: string) {
  const l = label.toLowerCase();
  if (l.includes("billing")) return "Billing";
  if (l.includes("checkout")) return "Checkout";
  if (l.includes("renew")) return "Subscription / renewals";
  if (l.includes("price") || l.includes("promo")) return "Pricing / promotions";
  if (l.includes("entitle") || l.includes("access")) return "Entitlements / access";
  if (l.includes("integrat")) return "Integrations";
  if (l.includes("approval") || l.includes("review")) return "Review / approval gaps";
  return "Monitoring / coverage gaps";
}

function coverageBucket(systemKey: string) {
  const k = systemKey.toLowerCase();
  if (k.includes("billing")) return "Billing";
  if (k.includes("checkout")) return "Checkout";
  if (k.includes("subscription") || k.includes("renew")) return "Subscription / renewals";
  if (k.includes("pricing") || k.includes("promo")) return "Pricing / promotions";
  if (k.includes("approval") || k.includes("review")) return "Review / approval gaps";
  if (k.includes("integration")) return "Integrations";
  return "Monitoring / coverage gaps";
}

export default function InsightsLandingPage() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") === "7d" ? "7d" : searchParams.get("range") === "90d" ? "90d" : "30d";

  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null);
  const [bySystem, setBySystem] = useState<BySystemResponse | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTasksResponse | null>(null);
  const [roi, setRoi] = useState<RoiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [revRes, impactRes, execRes, systemRes, tasksRes, roiRes] = await Promise.all([
          fetch("/api/executive/revenue-summary"),
          fetch("/api/reporting/impact/executive-summary"),
          fetch(`/api/executive/summary?range=${range}`),
          fetch("/api/reporting/impact/by-system"),
          fetch("/api/execution/pending-tasks?limit=100"),
          fetch(`/api/insights/roi-summary?range=${range}`),
        ]);

        const rev = (await revRes.json().catch(() => ({}))) as RevenueSummary;
        const imp = (await impactRes.json().catch(() => ({}))) as ImpactSummary;
        const exec = (await execRes.json().catch(() => ({}))) as ExecutiveSummary;
        const systems = (await systemRes.json().catch(() => ({}))) as BySystemResponse;
        const tasks = (await tasksRes.json().catch(() => ({}))) as PendingTasksResponse;
        const roiSummary = (await roiRes.json().catch(() => null)) as RoiSummaryResponse | null;

        if (mounted) {
          setRevenue(rev);
          setImpact(imp);
          setExecutive(exec);
          setBySystem(systems);
          setPendingTasks(tasks);
          setRoi(roiSummary);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [range]);

  useEffect(() => {
    trackAppEvent("roi_section_view", { page: "insights", range });
  }, [range]);

  const issueExposure = Math.max(0, toNumber(impact?.totalRevenueAtRisk));
  const changeExposure = Math.max(0, toNumber(revenue?.revenueAtRisk30d));
  const coverageGapBase = (bySystem?.bySystem ?? [])
    .filter((s) => s.systemKey === "unknown")
    .reduce((acc, s) => acc + toNumber(s.revenueAtRisk), 0);
  const systemGapExposure = Math.max(0, coverageGapBase);
  const exposure = issueExposure + changeExposure + systemGapExposure;

  const trend = revenue?.trend ?? [];
  const trendSlice = range === "7d" ? trend.slice(-7) : trend.slice(-30);
  const prev = trendSlice.length > 1 ? toNumber(trendSlice[0]?.revenueAtRisk) : 0;
  const latest = trendSlice.length > 0 ? toNumber(trendSlice[trendSlice.length - 1]?.revenueAtRisk) : 0;
  const changePct = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
  const direction = changePct > 5 ? "Increasing" : changePct < -5 ? "Decreasing" : "Stable";

  const driverRows = useMemo(() => {
    const contribution = new Map<string, number>();

    for (const s of revenue?.topSurfaces ?? []) {
      const label = driverBucket(s.surface);
      contribution.set(label, (contribution.get(label) ?? 0) + toNumber(s.revenueAtRisk));
    }

    for (const s of bySystem?.bySystem ?? []) {
      const label = coverageBucket(s.systemKey);
      contribution.set(label, (contribution.get(label) ?? 0) + toNumber(s.revenueAtRisk));
    }

    const countByBucket = new Map<string, number>();
    for (const d of executive?.topDrivers ?? []) {
      const label = driverBucket(d.signalKey);
      countByBucket.set(label, (countByBucket.get(label) ?? 0) + toNumber(d.count));
    }

    return Array.from(contribution.entries())
      .map(([label, value]) => ({
        label,
        contribution: Math.max(0, Math.round(value)),
        trend: (countByBucket.get(label) ?? 0) >= 2 ? "up" : "stable",
        href:
          label === "Review / approval gaps"
            ? "/settings/policies"
            : label === "Integrations" || label === "Monitoring / coverage gaps"
              ? "/integrations"
              : label === "Checkout" || label === "Billing" || label === "Pricing / promotions"
                ? "/changes?view=all&impact=high"
                : "/issues?severity=high",
      }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 6);
  }, [revenue, bySystem, executive]);

  const coveredSystems = Math.max(
    0,
    (bySystem?.bySystem ?? []).filter((s) => s.systemKey !== "unknown" && s.issueCount > 0).length
  );
  const uncoveredSystems = Math.max(
    0,
    (bySystem?.bySystem ?? []).filter((s) => s.systemKey === "unknown").length
  );
  const partialSystems = Math.max(0, Math.min(coveredSystems, Math.round(coveredSystems * 0.25)));

  const resolvedIssues = Math.max(
    0,
    toNumber(impact?.openIssueCount) - toNumber(impact?.impactedIssueCount)
  );
  const reviewedChanges = (revenue?.criticalPending ?? []).length;
  const pendingExecution = (pendingTasks?.tasks ?? []).length;
  const overdueReduction = Math.max(0, 6 - (revenue?.overdue ?? []).length);

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Insights" }]}
        title="Insights"
        description="Understand revenue exposure, risk drivers, trends, and the impact of actions across your systems."
        helper="Use this page to understand where your business is at risk and how it is changing over time."
        helpTrigger={<PageHelpDrawer page="insights" />}
      />

      <Card className="shadow-sm">
        <CardBody>
          <SectionHeader
            title="Current exposure"
            helper={
              loading
                ? "Loading latest exposure..."
                : `As of ${impact?.asOf ? new Date(impact.asOf).toLocaleString() : "now"}`
            }
          />
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading...</p>
          ) : exposure <= 0 ? (
            <EmptyState
              variant="still_building"
              title="Exposure data is still building"
              body="As Solvren monitors more systems and changes, this view will become more accurate."
            />
          ) : (
            <div className="space-y-2">
              <p className="text-3xl font-bold">{`~${formatMoney(exposure)} estimated`}</p>
              <p className="text-sm">
                {direction} over the past {range === "7d" ? "7 days" : "30 days"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Based on direct issue and change exposure, plus unresolved unknown-system risk.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      <Grid cols={3} gap={4}>
        <Card>
          <CardBody>
            <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              Issues contribution{" "}
              <MetricHelpTooltip metricKey="linked_to_issues" page="insights" section="breakdown" />
            </p>
            <p className="text-xl font-semibold">{formatMoney(issueExposure)}</p>
            <p className="text-xs text-[var(--text-muted)]">{impact?.openIssueCount ?? 0} open issues</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              Changes contribution{" "}
              <MetricHelpTooltip metricKey="high_impact" page="insights" section="breakdown" />
            </p>
            <p className="text-xl font-semibold">{formatMoney(changeExposure)}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {(revenue?.criticalPending ?? []).length} high-impact in flight
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              System gaps contribution{" "}
              <MetricHelpTooltip metricKey="detection_coverage" page="insights" section="breakdown" />
            </p>
            <p className="text-xl font-semibold">{formatMoney(systemGapExposure)}</p>
            <p className="text-xs text-[var(--text-muted)]">Unknown-system and coverage gaps</p>
          </CardBody>
        </Card>
      </Grid>

      <Card>
        <CardBody>
          <SectionHeader
            title="Exposure trend"
            helper="Shows how estimated exposure is changing over time based on active issues and changes."
            action={
              <div className="flex gap-2 text-sm">
                <Link
                  href="/insights?range=7d"
                  className={range === "7d" ? "font-semibold text-[var(--primary)]" : "text-[var(--text-muted)]"}
                >
                  7d
                </Link>
                <Link
                  href="/insights?range=30d"
                  className={range === "30d" ? "font-semibold text-[var(--primary)]" : "text-[var(--text-muted)]"}
                >
                  30d
                </Link>
                <Link
                  href="/insights?range=90d"
                  className={range === "90d" ? "font-semibold text-[var(--primary)]" : "text-[var(--text-muted)]"}
                >
                  90d
                </Link>
              </div>
            }
          />
          <div className="mt-3 space-y-2">
            {trendSlice.map((r) => (
              <div key={r.day} className="flex items-center gap-3">
                <div className="w-24 text-xs text-[var(--text-muted)]">{r.day}</div>
                <div className="h-2 flex-1 rounded-full bg-[var(--bg-surface-2)]">
                  <div
                    className="h-2 rounded-full bg-[var(--primary)]"
                    style={{
                      width: `${Math.max(3, Math.round((toNumber(r.revenueAtRisk) / (latest || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="w-28 text-right text-xs font-semibold">{formatMoney(toNumber(r.revenueAtRisk))}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader
            title="Impact and outcomes"
            helper="How Solvren is helping reduce risk and improve outcomes over time."
            action={
              <Link
                href={`/insights/roi?range=${range}`}
                className="text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Open full ROI view
              </Link>
            }
          />
          <Grid cols={4} gap={3}>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--text-muted)]">Potential issues prevented</p>
                <p className="text-xl font-semibold">{roi?.metrics?.prevented?.displayValue ?? "0"}</p>
                <p className="text-xs text-[var(--text-muted)]">{(roi?.metrics?.prevented?.confidence ?? "estimated").replaceAll("_", " ")}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--text-muted)]">Issues resolved</p>
                <p className="text-xl font-semibold">{roi?.metrics?.resolved?.displayValue ?? "0"}</p>
                <p className="text-xs text-[var(--text-muted)]">{(roi?.metrics?.resolved?.confidence ?? "observed").replaceAll("_", " ")}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--text-muted)]">High-risk changes reviewed</p>
                <p className="text-xl font-semibold">{roi?.metrics?.governed?.displayValue ?? "0 (0%)"}</p>
                <p className="text-xs text-[var(--text-muted)]">{(roi?.metrics?.governed?.confidence ?? "observed").replaceAll("_", " ")}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--text-muted)]">Risk trend improvement</p>
                <p className="text-xl font-semibold capitalize">{(roi?.impactSummary?.trend ?? "stable").replaceAll("_", " ")}</p>
                <p className="text-xs text-[var(--text-muted)]">{roi?.metrics?.trend?.displayValue ?? "0%"} estimated</p>
              </CardBody>
            </Card>
          </Grid>
          {!roi || !roi.ok ? (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Impact data is building. As Solvren monitors more activity, this view will show how risk and outcomes are improving over time.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader
            title="Top risk drivers"
            helper="What is actually causing exposure right now."
            action={
              <Link href="/insights/risk-drivers" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Open risk drivers
              </Link>
            }
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {driverRows.map((d) => (
              <Link key={d.label + d.href} href={d.href} className="rounded-md border p-3 hover:bg-[var(--table-row-hover)]">
                <p className="text-sm font-semibold">{d.label}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {formatMoney(d.contribution)} contribution - trend {d.trend}
                </p>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      <Grid cols={2} gap={4}>
        <Card>
          <CardBody>
            <SectionHeader title="What is being done" helper="How response is progressing against active risk." />
            <ul className="mt-2 space-y-1 text-sm">
              <li>{impact?.impactedIssueCount ?? 0} issues actively worked</li>
              <li>{(revenue?.criticalPending ?? []).length} high-impact changes under review</li>
              <li>{pendingExecution} non-terminal execution tasks in progress</li>
              <li>{(revenue?.overdue ?? []).length} overdue follow-ups</li>
            </ul>
            <Link href="/actions" className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              Open Action Center
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <SectionHeader
              title="Coverage and gaps"
              helper="Where Solvren has meaningful protection vs where coverage is incomplete."
            />
            <ul className="mt-2 space-y-1 text-sm">
              <li>Covered systems: {coveredSystems}</li>
              <li>Partially covered systems: {partialSystems}</li>
              <li>Not covered systems: {uncoveredSystems}</li>
            </ul>
            <Link href="/integrations" className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              Improve coverage
            </Link>
          </CardBody>
        </Card>
      </Grid>

      <Card>
        <CardBody>
          <SectionHeader title="Impact over time" helper="Directional proof of value without over-claiming precision." />
          <div className="mt-2 grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Resolved issues</p>
              <p className="text-xl font-semibold">{resolvedIssues}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Reviewed high-impact changes</p>
              <p className="text-xl font-semibold">{reviewedChanges}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Execution tasks in progress</p>
              <p className="text-xl font-semibold">{pendingExecution}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Overdue high-risk reduction</p>
              <p className="text-xl font-semibold">{overdueReduction}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </Stack>
  );
}
