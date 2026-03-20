/**
 * Phase 2 Gap 2 — Policy exceptions management.
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getPolicyById } from "@/modules/policy/repositories/policies.repository";
import { listExceptionsByPolicyId } from "@/modules/policy/repositories/policy-exceptions.repository";
import { PolicyExceptionsPanel } from "@/components/policy/PolicyExceptionsPanel";

export default async function PolicyExceptionsPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: policy } = await getPolicyById(supabase, policyId);
  if (!policy || (policy.org_id && policy.org_id !== activeOrgId)) notFound();

  const { data: exceptions } = await listExceptionsByPolicyId(supabase, policyId);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: policy.display_name, href: `/admin/policy/${policyId}` },
          { label: "Exceptions" },
        ]}
        title="Policy exceptions"
        description="Manage time-bound overrides for this policy."
        right={
          <Link href={`/admin/policy/${policyId}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Policy detail
          </Link>
        }
      />
      <PolicyExceptionsPanel policyId={policyId} orgId={policy.org_id ?? activeOrgId} exceptions={exceptions ?? []} />
    </div>
  );
}
