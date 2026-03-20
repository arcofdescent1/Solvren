/**
 * Phase 2 — GET /api/admin/simulations/:runId
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSimulationRun } from "@/modules/simulation/repositories/simulation-runs.repository";
import { listStepResults } from "@/modules/simulation/repositories/simulation-step-results.repository";
import { listEntityResults } from "@/modules/simulation/repositories/simulation-entity-results.repository";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ runId: string }> }
) {
  const { runId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: run, error } = await getSimulationRun(supabase, runId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.org_id !== (membership as { org_id: string }).org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: steps } = await listStepResults(supabase, runId);
  const { data: entities } = await listEntityResults(supabase, runId);

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
}
