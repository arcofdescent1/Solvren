import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import Link from "next/link";
import { PageHeader, Card, CardBody } from "@/ui";
import { RevenueRiskCopilot } from "@/components/revenue-risk-copilot/RevenueRiskCopilot";
import {
  RevenueRiskBriefingPanel,
  WhySolvrenMatters,
  DashboardHeroSection,
  DashboardNarrativeSummaryWithAI,
  TopRiskCardList,
  NextActionsPanelClient,
  ActivityTimelineFeed,
  MetricTrendCard,
  IntegrationStatusPanel,
} from "@/components/dashboard";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canRole } from "@/lib/rbac/permissions";
import { filterVisibleChanges } from "@/lib/access/changeAccess";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", data.user.id);

  const hasOrg = (memberships?.length ?? 0) > 0;

  const orgIds = (memberships ?? []).map((m) => m.org_id);

  const [{ activeOrgId, memberships: fullMemberships }] = await Promise.all([
    getActiveOrg(supabase, data.user.id),
  ]);
  const currentRole = parseOrgRole(
    fullMemberships.find((m) => m.orgId === activeOrgId)?.role ?? "viewer"
  );
  const isReviewerLike = canRole(currentRole, "change.approve");
  const canCreateChange = canRole(currentRole, "change.create");

  // Note: Counts are computed from visibility-filtered data below, not from raw queries.
  // Raw queries would mix in restricted changes the user cannot see.

  const { data: myApprovalRows } = await supabase
    .from("approvals")
    .select("change_event_id, approval_area, created_at")
    .in("org_id", orgIds)
    .eq("approver_user_id", data.user.id)
    .eq("decision", "PENDING")
    .order("created_at", { ascending: true })
    .limit(20);
  const myApprovalChangeIds = Array.from(
    new Set((myApprovalRows ?? []).map((r) => r.change_event_id))
  );

  const { data: inReviewRows } = await supabase
    .from("change_events")
    .select(
      "id, title, domain, systems_involved, submitted_at, due_at, created_by, status, sla_status, org_id, is_restricted"
    )
    .in("org_id", orgIds)
    .eq("status", "IN_REVIEW")
    .order("submitted_at", { ascending: false })
    .limit(15);

  const { data: overdueRows } = await supabase
    .from("change_events")
    .select(
      "id, title, domain, systems_involved, submitted_at, due_at, created_by, status, sla_status, org_id, is_restricted"
    )
    .in("org_id", orgIds)
    .eq("status", "IN_REVIEW")
    .lt("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(15);

  const { data: myApprovalChanges } = myApprovalChangeIds.length
    ? await supabase
        .from("change_events")
        .select(
          "id, title, domain, systems_involved, submitted_at, due_at, created_by, status, sla_status, org_id, is_restricted"
        )
        .in("id", myApprovalChangeIds)
        .limit(20)
    : { data: [] };

  const visibleInReviewRows = await filterVisibleChanges(supabase, data.user.id, inReviewRows ?? []);
  const visibleOverdueRows = await filterVisibleChanges(supabase, data.user.id, overdueRows ?? []);
  const visibleMyApprovalChanges = await filterVisibleChanges(supabase, data.user.id, myApprovalChanges ?? []);
  const myApprovalsCount = visibleMyApprovalChanges.length;

  // Failed outbox: only count changes the user can view
  let failedOutboxCount = 0;
  if (orgIds.length > 0) {
    const { data: failedOutbox } = await supabase
      .from("notification_outbox")
      .select("change_event_id")
      .in("org_id", orgIds)
      .eq("status", "FAILED");
    const failedChangeIds = Array.from(new Set((failedOutbox ?? []).map((o) => o.change_event_id).filter(Boolean)));
    if (failedChangeIds.length > 0) {
      const { data: failedChanges } = await supabase
        .from("change_events")
        .select("id, org_id, domain, status, created_by, is_restricted")
        .in("id", failedChangeIds);
      const visibleFailed = await filterVisibleChanges(supabase, data.user.id, failedChanges ?? []);
      failedOutboxCount = visibleFailed.length;
    }
  }

  const inReviewIds = visibleInReviewRows.map((r) => r.id);
  const { data: evidenceItems } = inReviewIds.length
    ? await supabase
        .from("change_evidence_items")
        .select("change_event_id, label, kind, severity, status")
        .in("change_event_id", inReviewIds)
        .eq("severity", "REQUIRED")
    : { data: [] };
  const missingEvidenceByChange = new Map<string, string[]>();
  for (const item of evidenceItems ?? []) {
    if (item.status === "PROVIDED" || item.status === "WAIVED") continue;
    const list = missingEvidenceByChange.get(item.change_event_id) ?? [];
    list.push(item.label || item.kind);
    missingEvidenceByChange.set(item.change_event_id, list);
  }
  const blockedRows = visibleInReviewRows.filter((r) =>
    (missingEvidenceByChange.get(r.id)?.length ?? 0) > 0
  );

  const actionsCount =
    myApprovalsCount + failedOutboxCount + visibleOverdueRows.length;

  // Experience 1 & 2 — Revenue Exposure + Recent Risk Events (last 7 days)
  const exposure: { totalExposure: number; highRiskEvents: number; unapprovedChanges: number; complianceRate: number } = {
    totalExposure: 0,
    highRiskEvents: 0,
    unapprovedChanges: 0,
    complianceRate: 100,
  };
  let riskEvents: Array<{
    id: string;
    provider: string;
    object: string;
    risk_type: string;
    risk_bucket?: string;
    impact_amount: number | null;
    risk_score: number;
    approved_at: string | null;
    change_event_id: string | null;
    timestamp: string;
    field?: string | null;
    old_value?: unknown;
    new_value?: unknown;
  }> = [];
  if (hasOrg && activeOrgId) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: reRows } = await supabase
      .from("risk_events")
      .select("id, provider, object, risk_type, risk_bucket, impact_amount, risk_score, approved_at, change_event_id, timestamp, field, old_value, new_value")
      .eq("org_id", activeOrgId)
      .gte("timestamp", since.toISOString())
      .order("timestamp", { ascending: false })
      .limit(20);
    riskEvents = (reRows ?? []) as typeof riskEvents;
    for (const e of riskEvents) {
      const impact = Number(e.impact_amount);
      const isOpen = !e.approved_at;
      if (Number.isFinite(impact) && isOpen) exposure.totalExposure += impact;
      if (e.risk_score > 80) exposure.highRiskEvents++;
      if (isOpen) exposure.unapprovedChanges++;
    }
    const approved = riskEvents.length - exposure.unapprovedChanges;
    exposure.complianceRate = riskEvents.length > 0 ? Math.round((approved / riskEvents.length) * 100) : 100;
  }

  // Narrative: highest-priority issue from top risk by score
  const topRiskForNarrative = [...riskEvents].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))[0];
  let narrativeHeadline: string | null = null;
  let narrativeSummary: string;
  let narrativeSuggestedAction: string | null = null;
  if (!hasOrg || !activeOrgId) {
    narrativeSummary = "Connect an organization to see your highest-priority revenue issue.";
    narrativeSuggestedAction = "Complete onboarding and connect Jira to detect revenue-impacting changes.";
  } else if (!topRiskForNarrative) {
    narrativeSummary = "No revenue risks detected in the last 7 days. When monitoring is active, your highest-priority issue will appear here.";
    narrativeSuggestedAction = "Connect Jira to begin detecting revenue-impacting changes.";
  } else {
    const impact = Number(topRiskForNarrative.impact_amount);
    const impactStr = Number.isFinite(impact)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(impact)
      : null;
    const riskType = (topRiskForNarrative.risk_type ?? "").replace(/_/g, " ");
    const source = topRiskForNarrative.provider ?? "Unknown";
    narrativeHeadline = `Unapproved ${riskType} from ${source}${topRiskForNarrative.object ? ` (${topRiskForNarrative.object})` : ""}`;
    narrativeSummary = impactStr
      ? `Your highest-priority issue is an unapproved revenue-related change from ${source} with an estimated impact of ${impactStr}.`
      : `Your highest-priority issue is an unapproved revenue-related change from ${source}.`;
    narrativeSuggestedAction = topRiskForNarrative.change_event_id
      ? "Review and approve the linked change, or investigate the risk."
      : "Link to a governed change or create a new change to track approval.";
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Overview" }]}
          title="Revenue Overview"
          description="What revenue is exposed, what matters most, and what to do next."
          right={
            <div className="flex flex-wrap gap-3">
              {hasOrg ? (
                <>
                  {canCreateChange ? (
                    <Link
                      data-testid="nav-new-change"
                      href="/changes/new"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition-colors hover:bg-[var(--primary-hover)]"
                    >
                      Declare Revenue Change
                    </Link>
                  ) : null}
                  <Link
                    href="/changes"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
                  >
                    Changes
                  </Link>
                  <Link
                    href="/risk/audit"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
                  >
                    Revenue Risks
                  </Link>
                  <Link
                    href="/reports/revenue-governance"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
                  >
                    Compliance Report
                  </Link>
                  <a
                    href="/api/metrics/executive/export?format=csv"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
                    download="executive-metrics.csv"
                  >
                    Export metrics (CSV)
                  </a>
                </>
              ) : (
                <Link
                  href="/onboarding"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm transition-colors hover:bg-[var(--primary-hover)]"
                >
                  Create organization
                </Link>
              )}
            </div>
          }
        />

        {/* Gap 7 — Revenue Risk Briefing (top of dashboard) */}
        {hasOrg && activeOrgId && (
          <RevenueRiskBriefingPanel orgId={activeOrgId} />
        )}

        {/* Why Solvren Matters */}
        {hasOrg && activeOrgId && (
          <WhySolvrenMatters />
        )}

        {/* Section 1 — Executive metrics */}
        {hasOrg && activeOrgId ? (
          <DashboardHeroSection
            totalExposure={exposure.totalExposure}
            highRiskEvents={exposure.highRiskEvents}
            unapprovedChanges={exposure.unapprovedChanges}
            complianceRate={exposure.complianceRate}
          />
        ) : (
          <Card>
            <CardBody className="py-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue Exposure Today</h2>
              <p className="mt-2 text-[var(--text)]">Connect Jira to begin detecting revenue-impacting changes.</p>
              <Link href="/onboarding" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
                Create or join an organization
              </Link>
            </CardBody>
          </Card>
        )}

        {/* Section 2 — Narrative summary (AI-enhanced with server fallback) */}
        <DashboardNarrativeSummaryWithAI
          fallback={{
            headline: narrativeHeadline,
            summary: narrativeSummary,
            suggestedAction: narrativeSuggestedAction,
            topEventId: topRiskForNarrative?.id ?? null,
          }}
          dashboardState={{
            total_exposure: exposure.totalExposure,
            high_risk_count: exposure.highRiskEvents,
            unapproved_count: exposure.unapprovedChanges,
            compliance_pct: exposure.complianceRate,
          }}
          riskEvents={riskEvents}
          changeRequests={visibleInReviewRows.slice(0, 5).map((c) => ({ id: c.id, title: c.title ?? "", status: c.status ?? "" }))}
        />

        {/* Section 2b — Metric trend (Gap 5) */}
        {hasOrg && activeOrgId && (
          <MetricTrendCard />
        )}

        {/* Section 3 — Top risk cards */}
        {hasOrg && activeOrgId && (
          <TopRiskCardList events={riskEvents} maxCards={5} />
        )}

        {/* Section 4 — My next actions (role-aware, client-fetched) */}
        <NextActionsPanelClient />

        {/* Section 5 — Activity timeline */}
        <ActivityTimelineFeed orgId={activeOrgId ?? null} limit={15} />

        {/* Integration health (Gap 7) */}
        {hasOrg && activeOrgId && (
          <IntegrationStatusPanel orgId={activeOrgId} />
        )}

        {/* Below the fold: queue summary and links */}
        {hasOrg && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isReviewerLike && (
            <Link data-testid="dashboard-tile-my-approvals" href="/queue/my-approvals" className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:bg-[var(--bg-surface-2)]">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                My Approvals
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
                {myApprovalsCount}
              </p>
            </Link>
          )}
          <Link data-testid="dashboard-tile-in-review" href="/queue/in-review" className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:bg-[var(--bg-surface-2)]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              In Review
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
              {visibleInReviewRows.length}
            </p>
          </Link>
          <Link data-testid="dashboard-tile-blocked" href="/queue/blocked" className="rounded-lg border border-[var(--warning)]/50 bg-[color:color-mix(in_oklab,var(--warning)_10%,var(--bg-surface))] p-4 hover:bg-[color:color-mix(in_oklab,var(--warning)_14%,var(--bg-surface))]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Blocked
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
              {blockedRows.length}
            </p>
          </Link>
          {isReviewerLike && (
            <Link data-testid="dashboard-tile-overdue" href="/queue/overdue" className="rounded-lg border border-[var(--danger)]/40 bg-[color:color-mix(in_oklab,var(--danger)_8%,var(--bg-surface))] p-4 hover:bg-[color:color-mix(in_oklab,var(--danger)_12%,var(--bg-surface))]">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Overdue
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
                {visibleOverdueRows.length}
              </p>
            </Link>
          )}
        </div>
      )}
      {actionsCount > 0 && (
        <Card className="border-[var(--warning)]/50 bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--bg-surface))]">
          <CardBody>
            <Link href="/changes" className="font-medium text-[var(--primary)] hover:underline">
              {actionsCount} item{actionsCount !== 1 ? "s" : ""} need attention
            </Link>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {myApprovalsCount > 0 && (
                <span>{myApprovalsCount} awaiting your approval</span>
              )}
              {failedOutboxCount > 0 && (
                <span>
                  {myApprovalsCount > 0 ? " · " : ""}
                  {failedOutboxCount} delivery failed
                </span>
              )}
              {visibleOverdueRows.length > 0 && (
                <span>
                  {myApprovalsCount > 0 || failedOutboxCount > 0 ? " · " : ""}
                  {visibleOverdueRows.length} overdue
                </span>
              )}
            </div>
          </CardBody>
        </Card>
      )}
      {hasOrg && (
        <div className="grid gap-4 xl:grid-cols-2">
          {isReviewerLike && (
            <Card>
              <CardBody>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">My Approvals</h2>
                  <Link href="/queue/my-approvals" className="text-xs text-[var(--primary)] hover:underline">View</Link>
                </div>
                {visibleMyApprovalChanges.slice(0, 6).length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No approvals pending.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleMyApprovalChanges.slice(0, 6).map((r) => (
                      <Link key={r.id} href={`/changes/${r.id}`} className="block rounded border border-[var(--border)] p-3 hover:bg-[var(--bg-surface-2)]">
                        <p className="text-sm font-medium text-[var(--text)]">{r.title ?? r.id}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {(r.domain ?? "REVENUE")} · {(r.systems_involved ?? []).slice(0, 2).join(", ") || "No systems"} · Due {r.due_at ? new Date(r.due_at).toLocaleString() : "—"}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardBody>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">In Review</h2>
                <Link href="/queue/in-review" className="text-xs text-[var(--primary)] hover:underline">View</Link>
              </div>
              {visibleInReviewRows.slice(0, 6).length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No active reviews.</p>
              ) : (
                <div className="space-y-2">
                  {visibleInReviewRows.slice(0, 6).map((r) => (
                    <Link key={r.id} href={`/changes/${r.id}`} className="block rounded border border-[var(--border)] p-3 hover:bg-[var(--bg-surface-2)]">
                      <p className="text-sm font-medium text-[var(--text)]">{r.title ?? r.id}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {(r.domain ?? "REVENUE")} · Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"} · {(r.sla_status ?? "ON_TRACK")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Blocked (Evidence Missing)</h2>
                <Link href="/queue/blocked" className="text-xs text-[var(--primary)] hover:underline">View</Link>
              </div>
              {blockedRows.slice(0, 6).length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No blocked items.</p>
              ) : (
                <div className="space-y-2">
                  {blockedRows.slice(0, 6).map((r) => (
                    <Link key={r.id} href={`/changes/${r.id}#evidence-checklist`} className="block rounded border border-[var(--border)] p-3 hover:bg-[var(--bg-surface-2)]">
                      <p className="text-sm font-medium text-[var(--text)]">{r.title ?? r.id}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Missing: {(missingEvidenceByChange.get(r.id) ?? []).slice(0, 2).join(", ")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
          {isReviewerLike && (
            <Card>
              <CardBody>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Overdue Reviews</h2>
                  <Link href="/queue/overdue" className="text-xs text-[var(--primary)] hover:underline">View</Link>
                </div>
                {visibleOverdueRows.slice(0, 6).length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No overdue reviews.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleOverdueRows.slice(0, 6).map((r) => (
                      <Link key={r.id} href={`/changes/${r.id}`} className="block rounded border border-[var(--danger)]/30 p-3 hover:bg-[var(--bg-surface-2)]">
                        <p className="text-sm font-medium text-[var(--text)]">{r.title ?? r.id}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Due {r.due_at ? new Date(r.due_at).toLocaleString() : "—"}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}
      </div>

      {/* Right sidebar: Copilot + Activity Timeline (xl+) */}
      {hasOrg && activeOrgId && (
        <div className="hidden xl:flex w-80 shrink-0 flex-col gap-6">
          <RevenueRiskCopilot
            activeOrgId={activeOrgId}
            page="dashboard"
            dashboardState={{
              total_exposure: exposure.totalExposure,
              high_risk_count: exposure.highRiskEvents,
              unapproved_count: exposure.unapprovedChanges,
              compliance_pct: exposure.complianceRate,
            }}
            riskEvents={riskEvents.slice(0, 5).map((e) => ({
              id: e.id,
              provider: e.provider,
              object: e.object,
              risk_type: e.risk_type,
              impact_amount: e.impact_amount,
              risk_bucket: e.risk_bucket,
              approved_at: e.approved_at,
              change_event_id: e.change_event_id,
            }))}
            changeRequests={[...(visibleInReviewRows ?? []), ...(visibleMyApprovalChanges ?? [])]
              .slice(0, 5)
              .map((c) => ({ id: c.id, title: c.title ?? c.id, status: c.status ?? "" }))}
          />
        </div>
      )}
    </div>
  );
}
