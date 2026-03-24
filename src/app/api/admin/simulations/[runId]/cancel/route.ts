/**
 * Phase 2 — POST /api/admin/simulations/:runId/cancel
 */
import { NextRequest, NextResponse } from "next/server";
import { cancelSimulation } from "@/modules/simulation/services/simulation-orchestrator.service";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
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

    const { error } = await cancelSimulation(authz.supabase, runId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "CANCELED" });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
