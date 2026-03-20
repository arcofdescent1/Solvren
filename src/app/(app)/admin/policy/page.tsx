/**
 * Phase 3 — Policy Center (§20.1).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listPolicies } from "@/modules/policy/repositories/policies.repository";
import { listPendingApprovals } from "@/modules/policy/repositories/approval-requests.repository";
import { listDecisionLogs } from "@/modules/policy/repositories/policy-decision-logs.repository";
import { PolicyCenterClient } from "@/components/policy/PolicyCenterClient";

export default async function PolicyCenterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const [{ data: policies }, { data: pendingApprovals }, { data: decisionLogs }] = await Promise.all([
    listPolicies(supabase, activeOrgId, {}),
    listPendingApprovals(supabase, activeOrgId),
    listDecisionLogs(supabase, activeOrgId, { limit: 20 }),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center" },
        ]}
        title="Policy Center"
        description="Authoritative policy enforcement. Manage policies, view decision logs, and handle approval requests."
        right={
          <Link href="/admin/policy/approvals" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Approval Queue →
          </Link>
        }
      />
      <PolicyCenterClient
        orgId={activeOrgId}
        policies={policies ?? []}
        pendingApprovals={pendingApprovals ?? []}
        decisionLogs={decisionLogs ?? []}
      />
    </div>
  );
}
