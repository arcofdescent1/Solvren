import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader, Card, CardBody } from "@/ui";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { RevenueRiskCopilot } from "@/components/revenue-risk-copilot/RevenueRiskCopilot";
import { RiskCard } from "@/components/risk/RiskCard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type RiskEvent = {
  id: string;
  provider: string;
  object: string;
  object_id: string;
  field?: string;
  risk_bucket: string;
  impact_amount?: number | null;
  approved_at?: string | null;
};

export default async function ExecutiveRiskPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId || !memberships.find((m) => m.orgId === activeOrgId)) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Revenue Risks" },
          ]}
          title="Revenue Risks"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">No organization selected.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const [summary7Res, summary1Res, eventsRes, trendRes] = await Promise.all([
    fetch(`${base}/api/risk-events/summary?orgId=${activeOrgId}&days=7`, { cache: "no-store" }),
    fetch(`${base}/api/risk-events/summary?orgId=${activeOrgId}&days=1`, { cache: "no-store" }),
    fetch(`${base}/api/risk-events?orgId=${activeOrgId}&days=7`, { cache: "no-store" }),
    fetch(`${base}/api/risk/trend?orgId=${activeOrgId}&days=14`, { cache: "no-store" }),
  ]);

  const summary7Data = (await summary7Res.json().catch(() => ({}))) as {
    ok?: boolean;
    summary?: {
      totalEvents?: number;
      totalRevenueImpact?: number;
      highRiskCount?: number;
      unapprovedCount?: number;
      compliancePct?: number;
      byProvider?: Record<string, number>;
    };
  };
  const summary1Data = (await summary1Res.json().catch(() => ({}))) as {
    ok?: boolean;
    summary?: {
      totalRevenueImpact?: number;
      highRiskCount?: number;
      unapprovedCount?: number;
      byProvider?: Record<string, number>;
    };
  };
  const summary = summary7Data.summary ?? {};
  const todaySummary = summary1Data.summary ?? {};

  const eventsData = (await eventsRes.json().catch(() => ({}))) as { ok?: boolean; events?: RiskEvent[] };
  const events = eventsData.events ?? [];
  const trendData = (await trendRes.json().catch(() => ({}))) as { ok?: boolean; trend?: Array<{ date: string; impact: number }> };
  const trend = trendData.trend ?? [];
  const allEvents = events;

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Revenue Risks" },
        ]}
        title="Revenue Risks"
        description="Revenue risk detected from your systems"
        right={
          <div className="flex flex-wrap gap-3">
            <Link href="/reports/revenue-governance" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Compliance Report
            </Link>
            <Link href="/executive" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Executive
            </Link>
            <Link href="/risk/audit" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Risk Audit
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue Exposure Today</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {formatMoney(todaySummary.totalRevenueImpact ?? summary.totalRevenueImpact ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">High Risk Count</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{summary.highRiskCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Unapproved</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{summary.unapprovedCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Compliance %</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{summary.compliancePct ?? 100}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Total Events (7d)</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{summary.totalEvents ?? 0}</p>
          </CardBody>
        </Card>
      </div>

      {trend.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold">Risk Trend</h2>
            <div className="flex h-24 items-end gap-1">
              {trend.slice(-14).map((t) => {
                const max = Math.max(...trend.map((x) => x.impact), 1);
                const h = max > 0 ? Math.max(4, (t.impact / max) * 80) : 0;
                return (
                  <div
                    key={t.date}
                    className="flex-1 rounded-t bg-[var(--primary)]/70 transition-opacity hover:opacity-90"
                    style={{ height: `${h}%` }}
                    title={`${t.date}: ${formatMoney(t.impact)}`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Daily revenue impact (last 14 days)
            </p>
          </CardBody>
        </Card>
      )}

      {(summary as { byProvider?: Record<string, number> }).byProvider &&
        Object.keys((summary as { byProvider?: Record<string, number> }).byProvider ?? {}).length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold">Risk by System</h2>
            <div className="space-y-2">
              {Object.entries((summary as { byProvider?: Record<string, number> }).byProvider ?? {})
                .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                .map(([provider, count]) => {
                  const total = Object.values((summary as { byProvider?: Record<string, number> }).byProvider ?? {}).reduce(
                    (s, c) => s + (c ?? 0),
                    0
                  );
                  const pct = total > 0 ? Math.round(((count ?? 0) / total) * 100) : 0;
                  return (
                    <div key={provider} className="flex items-center gap-3">
                      <span className="w-24 text-sm capitalize">{provider}</span>
                      <div className="flex-1 h-4 rounded bg-[var(--bg-muted)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--primary)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm text-[var(--text-muted)]">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="transition-shadow duration-200 hover:shadow-md">
        <CardBody>
          <h2 className="mb-4 font-semibold">Revenue Risks Detected</h2>
          {allEvents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No risk events in the last 7 days.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allEvents.map((e) => (
                <RiskCard
                  key={e.id}
                  id={e.id}
                  provider={e.provider}
                  object={e.object}
                  riskType={(e as { risk_type?: string }).risk_type ?? "REVENUE_RISK"}
                  impactAmount={e.impact_amount ?? null}
                  riskScore={(e as { risk_score?: number }).risk_score}
                  riskBucket={e.risk_bucket}
                  status={
                    e.approved_at ? "Approved" : (e as { change_event_id?: string }).change_event_id ? "Pending" : "Missing"
                  }
                  changeEventId={(e as { change_event_id?: string }).change_event_id}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      </div>

      {activeOrgId && (
        <div className="hidden xl:block w-80 shrink-0">
          <RevenueRiskCopilot
            activeOrgId={activeOrgId}
            page="risks"
            dashboardState={{
              total_exposure: (todaySummary.totalRevenueImpact ?? summary.totalRevenueImpact) ?? 0,
              high_risk_count: summary.highRiskCount ?? 0,
              unapproved_count: summary.unapprovedCount ?? 0,
              compliance_pct: summary.compliancePct ?? 100,
            }}
            riskEvents={allEvents.slice(0, 5).map((e) => ({
              id: e.id,
              provider: e.provider,
              object: e.object,
              risk_type: (e as { risk_type?: string }).risk_type ?? "",
              impact_amount: e.impact_amount,
              risk_bucket: e.risk_bucket,
              approved_at: e.approved_at,
              change_event_id: (e as { change_event_id?: string }).change_event_id,
            }))}
            changeRequests={[]}
          />
        </div>
      )}
    </div>
  );
}
