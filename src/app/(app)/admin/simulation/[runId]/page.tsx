/**
 * Phase 2 — Simulation detail view (§17.2).
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { getSimulationRun } from "@/modules/simulation/repositories/simulation-runs.repository";
import { listStepResults } from "@/modules/simulation/repositories/simulation-step-results.repository";
import { listEntityResults } from "@/modules/simulation/repositories/simulation-entity-results.repository";
import { SimulationDetailClient } from "@/components/simulation/SimulationDetailClient";

export default async function SimulationDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const { data: run, error } = await getSimulationRun(supabase, runId);
  if (error || !run) notFound();
  if (run.org_id !== activeOrgId) notFound();

  const { data: steps } = await listStepResults(supabase, runId);
  const { data: entities } = await listEntityResults(supabase, runId);

  const summary = run.result_summary_json as Record<string, unknown> | null;
  const confidence = run.confidence_summary_json as Record<string, unknown> | null;
  const warnings = (run.warning_summary_json ?? []) as string[];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Simulation Studio", href: "/admin/simulation" },
          { label: run.id.slice(0, 8) },
        ]}
        title={`Simulation ${run.id.slice(0, 8)}`}
        description={`${run.simulation_type} — ${run.status}`}
        right={
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/simulation/compare?baseline=${runId}`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              Compare
            </Link>
            <Link href="/admin/simulation" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Studio
            </Link>
          </div>
        }
      />
      <SimulationDetailClient
        runId={runId}
        run={run}
        summary={summary}
        confidence={confidence}
        warnings={warnings}
        steps={steps ?? []}
        entityResults={entities ?? []}
      />
    </div>
  );
}
