/**
 * Phase 2 Gap 2 — Policy decisions / decision trace viewer.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listDecisionLogs } from "@/modules/policy/repositories/policy-decision-logs.repository";

export default async function PolicyDecisionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: decisionLogs } = await listDecisionLogs(supabase, activeOrgId, { limit: 100 });

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: "Decision logs" },
        ]}
        title="Policy decision logs"
        description="Audit trail of policy evaluations. View matched rules, disposition, and reason codes."
        right={
          <Link href="/admin/policy" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Policy Center
          </Link>
        }
      />
      <Card>
        <CardBody>
          {!decisionLogs?.length ? (
            <p className="text-sm text-[var(--text-muted)]">No decisions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2">Action / Playbook</th>
                    <th className="text-left py-2">Disposition</th>
                    <th className="text-left py-2">Reason</th>
                    <th className="text-left py-2">Mode</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {decisionLogs.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--border)]">
                      <td className="py-1.5">{d.action_key ?? d.playbook_key ?? "—"}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            d.final_disposition === "BLOCK"
                              ? "text-red-600 dark:text-red-400"
                              : d.final_disposition === "REQUIRE_APPROVAL"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-green-600 dark:text-green-400"
                          }
                        >
                          {d.final_disposition}
                        </span>
                      </td>
                      <td className="py-1.5 text-[var(--text-muted)]">{d.decision_reason_code}</td>
                      <td className="py-1.5 text-[var(--text-muted)]">{d.effective_autonomy_mode}</td>
                      <td className="py-1.5 text-[var(--text-muted)]">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      <td className="py-1.5">
                        <Link
                          href={`/admin/policy/decisions/${d.id}`}
                          className="text-[var(--primary)] hover:underline text-xs"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
