/**
 * Phase 2 — GET /api/admin/simulations/:runId
 */
import { NextRequest, NextResponse } from "next/server";
import { getSimulationRun } from "@/modules/simulation/repositories/simulation-runs.repository";
import { listStepResults } from "@/modules/simulation/repositories/simulation-step-results.repository";
import { listEntityResults } from "@/modules/simulation/repositories/simulation-entity-results.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await ctx.params;

    const authz = await resolveResourceInOrg({
      table: "simulation_runs",
      resourceId: runId,
      permission: "admin.simulations.manage",
    });

    const { data: run, error } = await getSimulationRun(authz.supabase, runId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: steps } = await listStepResults(authz.supabase, runId);
    const { data: entities } = await listEntityResults(authz.supabase, runId);

    const summary = run.result_summary_json as Record<string, unknown> | null;
    const confidence = run.confidence_summary_json as Record<string, unknown> | null;
    const warnings = (run.warning_summary_json ?? []) as unknown[];

    return NextResponse.json({
      simulationRunId: run.id,
      status: run.status,
      summary: summary ?? {},
      confidence: confidence ?? {},
      warnings,
      steps: steps ?? [],
      entityResults: entities ?? [],
      config: run.config_json,
      createdAt: run.created_at,
      completedAt: run.completed_at,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
