/**
 * Phase 2 — POST /api/admin/simulations/compare
 */
import { NextRequest, NextResponse } from "next/server";
import { compareSimulationRuns } from "@/modules/simulation/services/simulation-orchestrator.service";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: { baselineRunId?: string; candidateRunId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { baselineRunId, candidateRunId } = body;
    if (!baselineRunId || !candidateRunId) {
      return NextResponse.json({ error: "baselineRunId and candidateRunId required" }, { status: 400 });
    }

    const { data, error } = await compareSimulationRuns(
      ctx.supabase,
      ctx.orgId,
      baselineRunId,
      candidateRunId
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json(data);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
