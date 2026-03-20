import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { PageHeader, Card, CardBody } from "@/ui";
import { AdminImpactAssumptionsClient } from "./AdminImpactAssumptionsClient";

export default async function AdminImpactAssumptionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  if (!isAdminLikeRole(parseOrgRole(membership.role ?? null))) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Impact Assumptions" }]} title="Impact Assumptions" />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access Impact Assumptions.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">← Dashboard</Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin", href: "/admin/domains" }, { label: "Impact Assumptions" }]}
        title="Impact Assumptions"
        description="Org-specific values used by impact models. Override defaults to calibrate estimates."
        right={<Link href="/admin/impact/models" className="text-sm font-semibold text-[var(--primary)] hover:underline">Impact Models →</Link>}
      />
      <AdminImpactAssumptionsClient />
    </div>
  );
}
