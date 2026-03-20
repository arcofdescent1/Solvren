/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/findings (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listDetectorFindings } from "@/modules/detection/persistence/detector-findings.repository";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (m as { org_id: string } | null)?.org_id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { detectorKey } = await params;
  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const { data: findings, error } = await listDetectorFindings(supabase, {
    orgId,
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
}
