/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/runs (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listDetectorRuns } from "@/modules/detection/persistence/detector-runs.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { detectorKey } = await params;
    const { data: def } = await getDetectorDefinitionByKey(ctx.supabase, detectorKey);
    if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

    const { data: runs, error } = await listDetectorRuns(ctx.supabase, {
      orgId: ctx.orgId,
      detectorDefinitionId: def.id,
      limit,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        runMode: r.run_mode,
        status: r.status,
        candidateCount: r.candidate_count,
        detectionCount: r.detection_count,
        suppressedCount: r.suppressed_count,
        errorCount: r.error_count,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      })),
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
