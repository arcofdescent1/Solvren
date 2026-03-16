/**
 * Gap 2: System Diagnostics — admin-only. Operational visibility (failed deliveries,
 * escalations, audit) and links to Jobs, Domain Builder. Not in primary nav.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import OpsOutboxTable from "@/components/OpsOutboxTable";
import { Card, CardBody, CardHeader, CardTitle } from "@/ui/primitives/card";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SystemDiagnosticsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(
    supabase,
    userRes.user.id
  );
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? null;
  if (!active?.orgId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">No organization found for your account.</p>
        <Link href="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Back to Overview
        </Link>
      </div>
    );
  }

  const isAdmin = isAdminLikeRole(parseOrgRole(active.role ?? null));
  if (!isAdmin) {
    redirect("/org/settings");
  }

  const orgId = active.orgId;

  const [
    { data: failedOutbox },
    { data: escalated },
    { data: audit },
  ] = await Promise.all([
    supabase
      .from("notification_outbox")
      .select("id, channel, template_key, status, attempt_count, last_error, created_at")
      .eq("org_id", orgId)
      .eq("status", "FAILED")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("change_events")
      .select("id, title, sla_status, due_at, submitted_at")
      .eq("org_id", orgId)
      .eq("status", "IN_REVIEW")
      .eq("sla_status", "ESCALATED")
      .order("due_at", { ascending: true })
      .limit(25),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, created_at, metadata")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System diagnostics"
        description="Admin-only visibility into delivery status, escalations, and audit activity."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "System diagnostics" },
        ]}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/jobs" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Jobs
            </Link>
            <span className="text-[var(--border)]">·</span>
            <Link href="/admin/domains" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Domain Builder
            </Link>
            <span className="text-[var(--border)]">·</span>
            <Link href="/settings/domains" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Domains
            </Link>
            <span className="text-[var(--border)]">·</span>
            <Link href="/settings/domain-permissions" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Domain permissions
            </Link>
            <span className="text-[var(--border)]">·</span>
            <Link href="/changes" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Revenue Changes
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Failed notification deliveries</CardTitle>
        </CardHeader>
        <CardBody>
          <OpsOutboxTable rows={(failedOutbox ?? []) as Parameters<typeof OpsOutboxTable>[0]["rows"]} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalated changes</CardTitle>
        </CardHeader>
        <CardBody>
          {(escalated ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">None</p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-sb)] border border-[var(--border)] bg-[var(--bg-surface)]">
              <div className="grid grid-cols-12 gap-2 border-b border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <div className="col-span-6">Change</div>
                <div className="col-span-3">Submitted</div>
                <div className="col-span-3">Due</div>
              </div>
              {(escalated ?? []).map(
                (c: { id: string; title?: string; submitted_at?: string; due_at?: string }) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 gap-2 border-b border-[var(--border)] px-3 py-3 text-[13px] transition last:border-b-0 hover:bg-[var(--bg-surface-2)]"
                  >
                    <div className="col-span-6">
                      <Link href={`/changes/${c.id}`} className="text-[var(--primary)] hover:underline">
                        {c.title ?? c.id}
                      </Link>
                    </div>
                    <div className="col-span-3 text-[12px] text-[var(--text-muted)]">
                      {c.submitted_at ?? ""}
                    </div>
                    <div className="col-span-3 text-[12px] text-[var(--text-muted)]">
                      {c.due_at ?? ""}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent audit activity</CardTitle>
        </CardHeader>
        <CardBody>
          {(audit ?? []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No audit events</p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-sb)] border border-[var(--border)] bg-[var(--bg-surface)]">
              <div className="grid grid-cols-12 gap-2 border-b border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <div className="col-span-3">Time</div>
                <div className="col-span-3">Action</div>
                <div className="col-span-3">Entity</div>
                <div className="col-span-3">Entity ID</div>
              </div>
              {(audit ?? []).map(
                (a: {
                  id: string;
                  created_at?: string;
                  action?: string;
                  entity_type?: string;
                  entity_id?: string;
                }) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-12 gap-2 border-b border-[var(--border)] px-3 py-3 text-[13px] transition last:border-b-0 hover:bg-[var(--bg-surface-2)]"
                  >
                    <div className="col-span-3 text-[12px] text-[var(--text-muted)]">
                      {a.created_at}
                    </div>
                    <div className="col-span-3">{a.action}</div>
                    <div className="col-span-3">{a.entity_type}</div>
                    <div className="col-span-3 text-[12px] text-[var(--text-muted)]">
                      {a.entity_id ?? ""}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
