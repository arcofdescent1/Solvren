/**
 * Phase 2 — POST /api/admin/simulations/run
 * Processes queued simulation runs. Can be triggered by cron or manually.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executeSimulation } from "@/modules/simulation/services/simulation-orchestrator.service";
import { listSimulationRuns, listQueuedRunsAcrossOrgs } from "@/modules/simulation/repositories/simulation-runs.repository";
import { SimulationStatus } from "@/modules/simulation/domain";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron && !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orgId: string | null = null;
  if (!isCron && userRes?.user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userRes.user.id)
      .limit(1)
      .maybeSingle();
    orgId = (membership as { org_id: string } | null)?.org_id ?? null;
  }

  const body = await req.json().catch(() => ({}));
  const runId = body.runId as string | undefined;

  if (runId) {
    const { data: run } = await (await import("@/modules/simulation/repositories/simulation-runs.repository")).getSimulationRun(supabase, runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (!isCron && run.org_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await executeSimulation(supabase, runId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, runId, status: "COMPLETED" });
  }

  const orgIdForQuery = orgId ?? (body.orgId as string) ?? "";
  if (!orgIdForQuery && !isCron) {
    return NextResponse.json({ error: "orgId required when not cron" }, { status: 400 });
  }

  const { data: runs } = isCron
    ? await listQueuedRunsAcrossOrgs(supabase, 5)
    : await listSimulationRuns(supabase, orgIdForQuery, { status: SimulationStatus.QUEUED, limit: 5 });
  let processed = 0;
  for (const r of runs ?? []) {
    const { error } = await executeSimulation(supabase, r.id);
    if (!error) processed++;
  }

  return NextResponse.json({ ok: true, processed, total: runs?.length ?? 0 });
}
