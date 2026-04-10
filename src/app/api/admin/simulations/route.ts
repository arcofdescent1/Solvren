/**
 * Phase 2 — POST /api/admin/simulations, GET list.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";
import { createSimulation } from "@/modules/simulation/services/simulation-orchestrator.service";
import { listSimulationRuns } from "@/modules/simulation/repositories/simulation-runs.repository";
import { SimulationType } from "@/modules/simulation/domain";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");
    const supabase = ctx.supabase;
    const orgId = ctx.orgId;
    const { data: runs, error } = await listSimulationRuns(supabase, orgId, { limit: 20 });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ simulations: runs ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");
    const supabase = ctx.supabase;
    const orgId = ctx.orgId;

    let body: {
      simulationType?: string;
      historicalWindowStart?: string;
      historicalWindowEnd?: string;
      scope?: { issueFamily?: string; detectorKeys?: string[]; playbookKey?: string; issueIds?: string[] };
      config?: { playbookKey?: string; autonomyMode?: string; policyOverrides?: Record<string, unknown> };
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const request = {
      simulationType: (body.simulationType ?? SimulationType.PLAYBOOK_BACKTEST) as SimulationType,
      historicalWindowStart: body.historicalWindowStart ?? start.toISOString(),
      historicalWindowEnd: body.historicalWindowEnd ?? end.toISOString(),
      scope: body.scope,
      config: body.config,
    };

    const { data, error } = await createSimulation(supabase, request, {
      orgId,
      actorUserId: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Create failed" }, { status: 500 });

    return NextResponse.json({
      simulationRunId: data.simulationRunId,
      status: data.status,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
