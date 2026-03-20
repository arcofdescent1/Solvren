/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/runs (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { listDetectorRuns } from "@/modules/detection/persistence/detector-runs.repository";

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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

  const { data: runs, error } = await listDetectorRuns(supabase, {
    orgId,
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
}
