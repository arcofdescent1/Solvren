/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/health (§17.1).
 */
import { NextResponse } from "next/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { detectorKey } = await params;
    const { data: def } = await getDetectorDefinitionByKey(ctx.supabase, detectorKey);
    if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

    // Stub: return not_enough_data until health snapshots are populated
    return NextResponse.json({
      status: "not_enough_data",
      coverageScore: 0,
      signalAvailabilityScore: 0,
      blindSpots: (def.required_signal_keys_json ?? []) as string[],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
