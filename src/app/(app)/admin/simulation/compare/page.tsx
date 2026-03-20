/**
 * Phase 2 — Simulation comparison view (§17.3).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listSimulationRuns } from "@/modules/simulation/repositories/simulation-runs.repository";
import { SimulationCompareClient } from "@/components/simulation/SimulationCompareClient";

export default async function SimulationComparePage({
  searchParams,
}: {
  searchParams: Promise<{ baseline?: string; candidate?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: runs } = await listSimulationRuns(supabase, activeOrgId, { limit: 50 });

  const runOptions = (runs ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    simulation_type: r.simulation_type,
    created_at: r.created_at,
    result_summary_json: r.result_summary_json,
    confidence_summary_json: r.confidence_summary_json,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Simulation Studio", href: "/admin/simulation" },
          { label: "Compare" },
        ]}
        title="Compare simulations"
        description="Side-by-side comparison of baseline vs candidate runs."
        right={
          <Link href="/admin/simulation" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Studio
          </Link>
        }
      />
      <SimulationCompareClient
        orgId={activeOrgId}
        runs={runOptions}
        initialBaselineId={params.baseline ?? null}
        initialCandidateId={params.candidate ?? null}
      />
    </div>
  );
}
