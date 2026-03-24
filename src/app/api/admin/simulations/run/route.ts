/**
 * Phase 2 — POST /api/admin/simulations/run
 * Processes queued simulation runs. Can be triggered by cron or manually.
 */
import { NextRequest, NextResponse } from "next/server";
import { executeSimulation } from "@/modules/simulation/services/simulation-orchestrator.service";
import {
  listSimulationRuns,
  listQueuedRunsAcrossOrgs,
} from "@/modules/simulation/repositories/simulation-runs.repository";
import { SimulationStatus } from "@/modules/simulation/domain";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isCron) {
      const supabase = await (await import("@/lib/supabase/server")).createServerSupabaseClient();
      const body = await req.json().catch(() => ({}));
      const runId = body.runId as string | undefined;

      if (runId) {
        const { getSimulationRun } = await import("@/modules/simulation/repositories/simulation-runs.repository");
        const { data: run } = await getSimulationRun(supabase, runId);
        if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

        const { error } = await executeSimulation(supabase, runId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, runId, status: "COMPLETED" });
      }

      const { data: runs } = await listQueuedRunsAcrossOrgs(supabase, 5);
      let processed = 0;
      for (const r of runs ?? []) {
        const { error } = await executeSimulation(supabase, r.id);
        if (!error) processed++;
      }
      return NextResponse.json({ ok: true, processed, total: runs?.length ?? 0 });
    }

    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const body = await req.json().catch(() => ({}));
    const runId = body.runId as string | undefined;

    if (runId) {
      const { getSimulationRun } = await import("@/modules/simulation/repositories/simulation-runs.repository");
      const { data: run } = await getSimulationRun(ctx.supabase, runId);
      if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
      if (run.org_id !== ctx.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { error } = await executeSimulation(ctx.supabase, runId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, runId, status: "COMPLETED" });
    }

    const { data: runs } = await listSimulationRuns(ctx.supabase, ctx.orgId, {
      status: SimulationStatus.QUEUED,
      limit: 5,
    });
    let processed = 0;
    for (const r of runs ?? []) {
      const { error } = await executeSimulation(ctx.supabase, r.id);
      if (!error) processed++;
    }

    return NextResponse.json({ ok: true, processed, total: runs?.length ?? 0 });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
