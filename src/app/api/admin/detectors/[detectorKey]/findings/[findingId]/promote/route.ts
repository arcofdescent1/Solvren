/**
 * Phase 4 — POST /api/admin/detectors/:detectorKey/findings/:findingId/promote (§17.2).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorFindingById } from "@/modules/detection/persistence/detector-findings.repository";
import { getDetectorDefinitionById } from "@/modules/detection/persistence/detector-definitions.repository";
import { escalateFindingToIssue } from "@/modules/detection/engine/issue-escalation.service";
import { updateDetectorFinding } from "@/modules/detection/persistence/detector-findings.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string; findingId: string }> }
) {
  try {
    const { findingId } = await params;

    await resolveResourceInOrg({
      table: "detector_findings",
      resourceId: findingId,
      permission: "admin.jobs.view",
    });

    const admin = createAdminClient();
    const { data: finding } = await getDetectorFindingById(admin, findingId);
    if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    if (finding.finding_status !== "actionable" && finding.finding_status !== "suppressed") {
      return NextResponse.json({ error: "Finding not promotable" }, { status: 400 });
    }

    const { data: def } = await getDetectorDefinitionById(admin, finding.detector_definition_id);
    const detectorKey = def?.detector_key ?? "unknown";

    const eb = finding.evidence_bundle_json as Record<string, unknown>;
    const result = await escalateFindingToIssue(admin, {
      detectorKey,
      findingId: finding.id,
      orgId: finding.org_id,
      title: (eb.headline as string) ?? "Detector finding",
      summary: (eb.detector_reason as string) ?? "",
      domain: "revenue",
      severity: finding.severity,
      priorityBand: finding.priority_band,
      primaryCanonicalEntityId: finding.primary_canonical_entity_id,
      secondaryEntityIds: [],
      evidenceBundle: eb,
      confidenceScore: finding.confidence_score,
      dedupeFingerprint: finding.dedupe_key,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

    await updateDetectorFinding(admin, findingId, {
      finding_status: "issue_created",
      issue_id: result.issueId,
    });

    return NextResponse.json({ ok: true, issueId: result.issueId });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
