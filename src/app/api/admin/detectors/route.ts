/**
 * Phase 4 — GET /api/admin/detectors (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listDetectorDefinitions } from "@/modules/detection/persistence/detector-definitions.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const packId = searchParams.get("packId") ?? undefined;
  const status = searchParams.get("status") ?? "active";

  const { data: defs, error } = await listDetectorDefinitions(supabase, { packId, status });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    detectors: defs.map((d) => ({
      id: d.id,
      detectorKey: d.detector_key,
      detectorPackId: d.detector_pack_id,
      displayName: d.display_name,
      description: d.description,
      category: d.category,
      businessProblem: d.business_problem,
      evaluationMode: d.evaluation_mode,
      requiredSignalKeys: d.required_signal_keys_json,
      defaultSeverity: d.default_severity,
      status: d.status,
    })),
  });
}
