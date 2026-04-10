/**
 * Phase 3 — Policy detail / edit.
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getPolicyById } from "@/modules/policy/repositories/policies.repository";
import { PolicyDetailClient } from "@/components/policy/PolicyDetailClient";

export default async function PolicyDetailPage({
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
  if (!policy) notFound();
  if (policy.org_id && policy.org_id !== activeOrgId) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: policy.display_name },
        ]}
        title={policy.display_name}
        description={policy.description}
        right={
          <Link href="/admin/policy" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Policy Center
          </Link>
        }
      />
      <PolicyDetailClient policy={policy} />
    </div>
  );
}
