/**
 * Phase 4 — Action executions list (§19.2).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listActionExecutions } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";

export default async function IntegrationExecutionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: executions } = await listActionExecutions(supabase, activeOrgId, {}, 100);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Integration Reliability", href: "/admin/integrations/reliability" },
          { label: "Executions" },
        ]}
        title="Action executions"
        description="Authoritative outbound execution records."
        right={
          <Link href="/admin/integrations/reliability" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Reliability
          </Link>
        }
      />
      <div className="overflow-x-auto rounded border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
              <th className="text-left py-3 px-4">Provider</th>
              <th className="text-left py-3 px-4">Action</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Attempts</th>
              <th className="text-left py-3 px-4">Reconciliation</th>
              <th className="text-left py-3 px-4">Time</th>
              <th className="text-left py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {(executions ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                  No executions yet.
                </td>
              </tr>
            ) : (
              (executions ?? []).map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]">
                  <td className="py-2 px-4">{e.provider}</td>
                  <td className="py-2 px-4 font-mono text-xs">{e.action_key}</td>
                  <td className="py-2 px-4">{e.execution_status}</td>
                  <td className="py-2 px-4">{e.attempt_count}</td>
                  <td className="py-2 px-4">{e.reconciliation_status}</td>
                  <td className="py-2 px-4 text-[var(--text-muted)]">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-4">
                    <Link href={`/admin/integrations/executions/${e.id}`} className="text-xs text-[var(--primary)] hover:underline">
                      Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
