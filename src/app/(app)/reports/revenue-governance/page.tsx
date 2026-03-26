/**
 * CFO Feature — Revenue Governance Compliance Report
 * "SOX-style revenue governance proof in one click."
 */
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import {
  PageHeader,
  PageHeaderV2,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/ui";
import { getActiveOrg } from "@/lib/org/activeOrg";

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function RevenueGovernanceReportPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId || !memberships.find((m) => m.orgId === activeOrgId)) {
    return (
      <div className="space-y-4">
        <PageHeaderV2
          breadcrumbs={[
            { label: "Insights", href: "/insights" },
            { label: "Governance Reports" },
          ]}
          title="Governance Reports"
          helper="Governance metrics complement Insights exposure and driver views with policy and control evidence."
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
  const reportRes = await fetch(
    `${base}/api/reports/revenue-governance?orgId=${activeOrgId}&days=90`,
    { cache: "no-store" }
  );
  const report = (await reportRes.json().catch(() => ({}))) as {
    totalChanges?: number;
    approvedChanges?: number;
    unapprovedChanges?: number;
    complianceRate?: number;
    riskExposure?: number;
    byCategory?: Array<{ category: string; count: number; revenueImpact: number }>;
  };

  const totalChanges = report.totalChanges ?? 0;
  const approvedChanges = report.approvedChanges ?? 0;
  const unapprovedChanges = report.unapprovedChanges ?? 0;
  const complianceRate = report.complianceRate ?? 100;
  const riskExposure = report.riskExposure ?? 0;
  const byCategory = report.byCategory ?? [];

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: exceptions } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "id, title, change_type, structured_change_type, systems_involved, revenue_at_risk, status"
    ))
    .eq("org_id", activeOrgId)
    .in("status", ["IN_REVIEW", "REJECTED"])
    .gte("submitted_at", since.toISOString())
    .order("submitted_at", { ascending: false })
    .limit(20);

  const changeIds = (exceptions ?? []).map((e) => (e as { id: string }).id);
  const { data: evidenceByChange } =
    changeIds.length > 0
      ? await supabase
          .from("change_evidence_items")
          .select("change_event_id, kind, label, status")
          .in("change_event_id", changeIds)
      : { data: [] };
  const missingByChange = new Map<string, string[]>();
  for (const e of evidenceByChange ?? []) {
    const cid = (e as { change_event_id: string }).change_event_id;
    const status = (e as { status: string }).status;
    if (status !== "PROVIDED" && status !== "WAIVED") {
      const list = missingByChange.get(cid) ?? [];
      list.push((e as { label?: string }).label ?? (e as { kind: string }).kind);
      missingByChange.set(cid, list);
    }
  }

  const { data: approvedWithDetails } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, title, change_type, systems_involved, revenue_at_risk, status"))
    .eq("org_id", activeOrgId)
    .eq("status", "APPROVED")
    .gte("submitted_at", since.toISOString())
    .order("submitted_at", { ascending: false })
    .limit(10);

  const approvedIds = (approvedWithDetails ?? []).map((a) => (a as { id: string }).id);
  const { data: approvals } =
    approvedIds.length > 0
      ? await supabase
          .from("approvals")
          .select("change_event_id, approval_area, decision, decided_at")
          .in("change_event_id", approvedIds)
      : { data: [] };
  const { data: evidenceItems } =
    approvedIds.length > 0
      ? await supabase
          .from("change_evidence_items")
          .select("change_event_id, kind, label, status")
          .in("change_event_id", approvedIds)
      : { data: [] };

  const approvalsByChange = new Map<string, Array<{ area: string; decision: string; at: string }>>();
  for (const a of approvals ?? []) {
    const cid = (a as { change_event_id: string }).change_event_id;
    const list = approvalsByChange.get(cid) ?? [];
    list.push({
      area: (a as { approval_area: string }).approval_area,
      decision: (a as { decision: string }).decision,
      at: (a as { decided_at?: string }).decided_at ?? "",
    });
    approvalsByChange.set(cid, list);
  }
  const evidenceByChangeMap = new Map<string, Array<{ kind: string; label: string }>>();
  for (const e of evidenceItems ?? []) {
    const cid = (e as { change_event_id: string }).change_event_id;
    const list = evidenceByChangeMap.get(cid) ?? [];
    if ((e as { status: string }).status === "PROVIDED" || (e as { status: string }).status === "WAIVED") {
      list.push({
        kind: (e as { kind: string }).kind,
        label: (e as { label?: string }).label ?? (e as { kind: string }).kind,
      });
    }
    evidenceByChangeMap.set(cid, list);
  }

  const exportBase = `/api/reports/revenue-governance/export?orgId=${activeOrgId}&days=90`;

  return (
    <div className="space-y-6">
      <PageHeaderV2
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "Governance Reports" },
        ]}
        title="Governance Reports"
        description="SOX-style revenue governance proof in one click"
        helper="Use this report to understand control coverage and compliance posture in the broader Insights narrative."
        actions={
          <div className="flex flex-wrap gap-3">
            <a
              href={`${exportBase}&format=json`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              Download JSON
            </a>
            <a
              href={`${exportBase}&format=csv`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              Download CSV
            </a>
            <a
              href={`${exportBase}&format=pdf`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              Download PDF
            </a>
            <Link href="/insights" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Insights
            </Link>
          </div>
        }
      />

      {totalChanges === 0 && byCategory.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-[var(--text)]">No report data yet. Reports become available after changes and approvals are recorded.</p>
            <Link href="/changes" className="mt-4 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
              Go to Revenue Changes
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
      <Card className="border-[var(--border)]">
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">
            Period: Last 90 Days · Generated: {new Date().toLocaleDateString()}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Revenue Impacting Changes
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{totalChanges}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Approved Changes
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{approvedChanges}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Unapproved Changes
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{unapprovedChanges}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Compliance Rate
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{complianceRate}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Unapproved Risk Exposure
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{formatMoney(riskExposure)}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="border-[var(--primary)]/40 bg-gradient-to-br from-[var(--primary)]/5 to-transparent">
        <CardBody>
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Revenue Governance Compliance Score
          </h2>
          <p className="mt-2 text-5xl font-bold tracking-tight text-[var(--text)]">
            {complianceRate}%
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            How controlled our revenue systems are
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold">Section 1 — Revenue Change Summary</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Change Category</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Revenue Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory.map((r) => (
                <TableRow key={r.category}>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell>{formatMoney(r.revenueImpact)}</TableCell>
                </TableRow>
              ))}
              {byCategory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-[var(--text-muted)]">
                    No revenue changes in the period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold">Section 2 — Governance Compliance</h2>
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <div className="h-4 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${complianceRate}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>Approved: {complianceRate}%</span>
                <span>Unapproved: {100 - complianceRate}%</span>
              </div>
            </div>
          </div>
          <h3 className="mb-2 text-sm font-medium">Exceptions</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Change</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(exceptions ?? []).map((e) => {
                const ex = e as {
                  id: string;
                  title?: string;
                  change_type?: string;
                  structured_change_type?: string;
                  systems_involved?: string[];
                  revenue_at_risk?: number;
                  status: string;
                };
                const missing = missingByChange.get(ex.id) ?? [];
                const statusLabel =
                  ex.status === "REJECTED"
                    ? "Rejected"
                    : missing.length > 0
                      ? "Missing Evidence"
                      : "Pending";
                return (
                  <TableRow key={ex.id}>
                    <TableCell>
                      <Link href={`/changes/${ex.id}`} className="text-[var(--primary)] hover:underline">
                        {ex.title ?? ex.change_type ?? ex.id}
                      </Link>
                    </TableCell>
                    <TableCell>{(ex.systems_involved ?? []).join(", ") || "—"}</TableCell>
                    <TableCell>{formatMoney(ex.revenue_at_risk ?? 0)}</TableCell>
                    <TableCell>{statusLabel}</TableCell>
                  </TableRow>
                );
              })}
              {(!exceptions || exceptions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-[var(--text-muted)]">
                    No exceptions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold">Section 3 — Approval Evidence</h2>
          <div className="space-y-6">
            {(approvedWithDetails ?? []).slice(0, 5).map((c) => {
              const ch = c as {
                id: string;
                title?: string;
                change_type?: string;
                systems_involved?: string[];
                revenue_at_risk?: number;
              };
              const approvers = approvalsByChange.get(ch.id) ?? [];
              const evidence = evidenceByChangeMap.get(ch.id) ?? [];
              return (
                <div key={ch.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-[var(--text)]">
                        <Link href={`/changes/${ch.id}`} className="text-[var(--primary)] hover:underline">
                          {ch.title ?? ch.change_type ?? ch.id}
                        </Link>
                      </h3>
                      <p className="text-sm text-[var(--text-muted)]">
                        System: {(ch.systems_involved ?? []).join(", ") || "—"} · Impact: {formatMoney(ch.revenue_at_risk ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Approvals</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {approvers.map((a, i) => (
                          <li key={i}>
                            {a.area}: {a.decision}
                            {a.at ? ` at ${new Date(a.at).toLocaleString()}` : ""}
                          </li>
                        ))}
                        {approvers.length === 0 && <li className="text-[var(--text-muted)]">—</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Evidence</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {evidence.map((e, i) => (
                          <li key={i}>{e.label || e.kind}</li>
                        ))}
                        {evidence.length === 0 && <li className="text-[var(--text-muted)]">—</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
            {(approvedWithDetails ?? []).length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No approved changes in the period</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold">Section 4 — Audit Trail Export</h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Export full history for auditors. Includes change_requests, approvals, evidence, risk_events, audit_log.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${exportBase}&format=json`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] hover:opacity-90"
            >
              Download Audit Package (JSON)
            </a>
            <a
              href={`${exportBase}&format=csv`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
            >
              Download Audit Package (CSV)
            </a>
            <a
              href={`${exportBase}&format=pdf`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
            >
              Download Audit Package (PDF)
            </a>
          </div>
        </CardBody>
      </Card>
        </>
      )}
    </div>
  );
}
