/**
 * Phase 9 — Autonomy safety controls page.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { AutonomyControlsPage } from "@/components/autonomy-safety";

export default async function AutonomySafetyPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Autonomy Safety"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Autonomy Safety" }]}
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access Autonomy Safety controls.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Autonomy Safety" },
        ]}
        title="Autonomy Safety"
        description="Configure execution modes, pause controls, and environment ceilings."
      />
      <AutonomyControlsPage />
    </div>
  );
}
