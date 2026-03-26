import Link from "next/link";
import { headers } from "next/headers";
import {
  PageHeader,
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
        <PageHeader
          breadcrumbs={[
            { label: "Insights", href: "/insights" },
            { label: "Executive summary" },
          ]}
          title="Executive Summary"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">
              Unable to load: {data?.error ?? "unknown_error"}
            </p>
            <Link href="/changes" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              Go to Revenue Changes →
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const ra = data.revenueAtRisk;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "Executive summary" },
        ]}
        title="Executive Summary"
        description={`Last ${data.rangeDays} days`}
        right={
          <div className="flex flex-wrap gap-3">
            <Link href="/insights/roi" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ROI →
            </Link>
            <Link href="/insights/risk-drivers" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Risk Drivers →
            </Link>
            <Link href="/changes" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Revenue Changes →
            </Link>
            <Link href="/changes/new" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              New Change →
            </Link>
          </div>
        }
      />

      <ExecutiveNarrativeCard />
      <RevenueAtRiskCard />
      <TopDriversTable />
      <ExecutiveInsightsPanel />

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
            <p className="mt-1 text-xs text-[var(--text-muted)]">SLA pressure items</p>
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
          <CardTitle>Top Risk Drivers</CardTitle>
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
