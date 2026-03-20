/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey/health (§17.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";

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
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { detectorKey } = await params;
  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  // Stub: return not_enough_data until health snapshots are populated
  return NextResponse.json({
    status: "not_enough_data",
    coverageScore: 0,
    signalAvailabilityScore: 0,
    blindSpots: (def.required_signal_keys_json ?? []) as string[],
  });
}
