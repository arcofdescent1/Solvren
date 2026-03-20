/**
 * Phase 3 — Create policy.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { PolicyCreateClient } from "@/components/policy/PolicyCreateClient";

export default async function PolicyNewPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: "Create policy" },
        ]}
        title="Create policy"
        description="Add a new policy with rules. Use action scope for actionKey, playbook scope for playbookKey."
        right={
          <Link href="/admin/policy" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Policy Center
          </Link>
        }
      />
      <PolicyCreateClient orgId={activeOrgId} />
    </div>
  );
}
