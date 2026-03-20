/**
 * Phase 2 — Simulation Studio (§17.1).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { SimulationStudioClient } from "@/components/simulation/SimulationStudioClient";

export default async function SimulationStudioPage() {
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
          title="Simulation Studio"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Simulation Studio" }]}
        />
        <p className="text-sm text-[var(--text-muted)]">Only org admins can access the Simulation Studio.</p>
        <Link href="/dashboard" className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Simulation Studio" },
        ]}
        title="Simulation Studio"
        description="Run deterministic simulations against historical data. Preview policy and playbook behavior without live side effects."
      />
      <SimulationStudioClient orgId={activeOrgId} />
    </div>
  );
}
