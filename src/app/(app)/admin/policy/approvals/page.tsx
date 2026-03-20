/**
 * Phase 3 — Approval Queue (§20.4).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listPendingApprovals } from "@/modules/policy/repositories/approval-requests.repository";
import { ApprovalQueueClient } from "@/components/policy/ApprovalQueueClient";

export default async function ApprovalQueuePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: pendingApprovals } = await listPendingApprovals(supabase, activeOrgId);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: "Approval Queue" },
        ]}
        title="Approval Queue"
        description="Pending policy-required approvals. Approve or reject to unblock execution."
        right={
          <Link href="/admin/policy" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Policy Center
          </Link>
        }
      />
      <ApprovalQueueClient approvals={pendingApprovals ?? []} />
    </div>
  );
}
