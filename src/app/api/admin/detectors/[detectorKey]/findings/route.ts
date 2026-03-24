/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/findings (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listDetectorFindings } from "@/modules/detection/persistence/detector-findings.repository";
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
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

    const { data: findings, error } = await listDetectorFindings(ctx.supabase, {
      orgId: ctx.orgId,
      detectorDefinitionId: def.id,
      findingStatus: status,
      limit,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      findings: findings.map((f) => ({
        id: f.id,
        findingStatus: f.finding_status,
        severity: f.severity,
        confidenceScore: f.confidence_score,
        primaryEntityId: f.primary_canonical_entity_id,
        issueId: f.issue_id,
        evidenceBundle: f.evidence_bundle_json,
        createdAt: f.created_at,
      })),
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
