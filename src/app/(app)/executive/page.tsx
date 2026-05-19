import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import {
  PageHeaderV2,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@/ui";
import ExecutiveNarrativeCard from "@/components/executive/ExecutiveNarrativeCard";
import RevenueAtRiskCard from "@/components/executive/RevenueAtRiskCard";
import TopDriversTable from "@/components/executive/TopDriversTable";
import ExecutiveInsightsPanel from "@/components/executive/ExecutiveInsightsPanel";
import ValueEngineIssuesSection from "@/components/executive/ValueEngineIssuesSection";
import NeedsAttentionCard from "@/components/executive/NeedsAttentionCard";
import { Phase3ExecutiveTracker } from "@/components/onboarding/phase3/Phase3ExecutiveTracker";
import { Phase3FromEmailSummaryTracker } from "@/components/onboarding/phase3/Phase3FromEmailSummaryTracker";

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

async function fetchSummary() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/executive/summary?range=30d`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function ExecutivePage() {
  const data = await fetchSummary();

  if (!data?.ok) {
    return (
      <div className="space-y-4">
        <PageHeaderV2
          breadcrumbs={[
            { label: "Insights", href: "/insights" },
            { label: "Executive summary" },
          ]}
          title="Executive Summary"
          helper="Use this view for a concise narrative of exposure, risk concentration, and executive follow-up priorities."
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">
              Executive summary could not be loaded right now.
            </p>
            <Link href="/changes" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              Go to revenue changes
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const ra = data.revenueAtRisk;

  return (
    <div className="max-h-[min(900px,100dvh)] space-y-4 overflow-y-auto lg:max-h-[900px] lg:overflow-y-hidden">
      <Suspense fallback={null}>
        <Phase3FromEmailSummaryTracker />
      </Suspense>
      <Phase3ExecutiveTracker path="/executive" />
      <PageHeaderV2
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "Executive summary" },
        ]}
        title="Executive Summary"
        description={`Last ${data.rangeDays} days`}
        helper="This view aligns to the Insights narrative: current exposure, drivers, trends, and what is being done."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/insights/roi" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ROI
            </Link>
            <Link href="/insights/risk-drivers" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Exposure drivers
            </Link>
            <Link href="/changes" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Revenue changes
            </Link>
            <Link href="/intake/new" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              New change
            </Link>
          </div>
        }
      />

      <Card className="border-[var(--primary)]/20 bg-[var(--bg-surface)]">
        <CardBody>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Board-ready view</p>
              <h2 className="mt-1 text-xl font-semibold">Revenue protected, decisions needed, and change confidence</h2>
              <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
                Solvren ties every revenue-sensitive change to exposure, ownership, evidence, action, and verified outcome so leaders can approve quickly without reading the implementation details.
              </p>
            </div>
            <div className="grid min-w-[280px] grid-cols-3 gap-2 text-center text-sm">
              <Link href="/insights/roi" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 hover:border-[var(--primary)]/40">
                <p className="text-xs text-[var(--text-muted)]">Prove</p>
                <p className="font-semibold">Value</p>
              </Link>
              <Link href="/actions" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 hover:border-[var(--primary)]/40">
                <p className="text-xs text-[var(--text-muted)]">Decide</p>
                <p className="font-semibold">Work</p>
              </Link>
              <Link href="/readiness" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 hover:border-[var(--primary)]/40">
                <p className="text-xs text-[var(--text-muted)]">Release</p>
                <p className="font-semibold">Safely</p>
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>

      <ExecutiveNarrativeCard />
      <RevenueAtRiskCard />
      <TopDriversTable />
      <ExecutiveInsightsPanel />

      <Suspense fallback={null}>
        <NeedsAttentionCard />
      </Suspense>

      <ValueEngineIssuesSection />

      {data.phase5 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Issues revenue at risk</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text)]">
                {formatMoney((data.phase5.issuesRevenueAtRiskCents ?? 0) / 100)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Open issues (single-currency org assumption)</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">ROI (verified)</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text)]">
                {formatMoney(
                  (Object.values(data.phase5.roiByType ?? {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0) /
                    100
                )}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Verified impact events</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Needs attention</p>
              <p className="mt-2 text-sm text-[var(--text)]">
                Approval {data.phase5.needsAttention?.approvalPending - 0} - Deadline missed{" "}
                {data.phase5.needsAttention?.slaBreached - 0} - Unassigned high-impact{" "}
                {data.phase5.needsAttention?.unassignedHighImpact ?? 0}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Trend window</p>
              <p className="mt-2 text-sm text-[var(--text)]">30 days - {data.phase5.timezone ?? "UTC"}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Issues opened vs resolved per day</p>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue at Risk (MRR)</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{formatMoney(ra.totalEstimatedMrrAffected)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Sum of estimated MRR where provided</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Critical changes</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{ra.criticalChangeCount}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Needs exec attention</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">High + Critical</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{ra.highChangeCount}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Risky changes in flight</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Overdue / Escalated</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{ra.overdueCount}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Deadline pressure items</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By Revenue Surface</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Surface</TableHead>
                <TableHead>Critical</TableHead>
                <TableHead>High+</TableHead>
                <TableHead>MRR Affected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.byRevenueSurface ?? []).map((row: { surface: string; critical: number; high: number; mrrAffected?: number }) => (
                <TableRow key={row.surface}>
                  <TableCell className="font-bold">{row.surface}</TableCell>
                  <TableCell>{row.critical}</TableCell>
                  <TableCell>{row.high}</TableCell>
                  <TableCell>{formatMoney(row.mrrAffected ?? 0)}</TableCell>
                </TableRow>
              ))}
              {(!data.byRevenueSurface || data.byRevenueSurface.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-[var(--text-muted)]">
                    No assessed changes yet. Compute an assessment on a change to populate this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Exposure Drivers</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {(data.topDrivers ?? []).map((d: { signalKey: string; count: number }) => (
              <Badge key={d.signalKey} variant="secondary">
                {d.signalKey} <span className="opacity-70">({d.count})</span>
              </Badge>
            ))}
            {(!data.topDrivers || data.topDrivers.length === 0) && (
              <span className="text-sm text-[var(--text-muted)]">
                No signal history yet (run compute on a few changes first).
              </span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
