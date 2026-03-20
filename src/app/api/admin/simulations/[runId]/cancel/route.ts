/**
 * Phase 2 — POST /api/admin/simulations/:runId/cancel
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelSimulation } from "@/modules/simulation/services/simulation-orchestrator.service";
import { getSimulationRun } from "@/modules/simulation/repositories/simulation-runs.repository";

export async function POST(
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

  const { data: run } = await getSimulationRun(supabase, runId);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.org_id !== (membership as { org_id: string }).org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await cancelSimulation(supabase, runId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, status: "CANCELED" });
}
