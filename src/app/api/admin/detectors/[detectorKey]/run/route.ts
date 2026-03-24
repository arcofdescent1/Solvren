/**
 * Phase 4 — POST /api/admin/detectors/:detectorKey/run (§17.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import { runDetector } from "@/modules/detection/engine/detector-runner.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");
    const supabase = ctx.supabase;
    const orgId = ctx.orgId;

    const { detectorKey } = await params;
    const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
    if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

    let body: { windowHours?: number } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const windowHours = body.windowHours ?? 168;
    const windowEnd = new Date();
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const requiredSignals = (def.required_signal_keys_json ?? []) as string[];
    const signalKey = requiredSignals[0] ?? "payment_failed";
    const { data: signals } = await listNormalizedSignals(supabase, {
      orgId,
      signalKey,
      fromTime: windowStart.toISOString(),
      toTime: windowEnd.toISOString(),
      limit: 100,
    });

    const admin = createPrivilegedClient("POST /api/admin/detectors/[detectorKey]/run");
    const result = await runDetector(admin, {
      orgId,
      detectorKey,
      signals,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    return NextResponse.json(result);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
