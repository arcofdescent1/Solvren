/**
 * Phase 4 — GET /api/admin/detectors/:detectorKey (§17.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ detectorKey: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { detectorKey } = await params;
  const { data: def, error } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!def) return NextResponse.json({ error: "Detector not found" }, { status: 404 });

  return NextResponse.json({
    id: def.id,
    detectorKey: def.detector_key,
    detectorPackId: def.detector_pack_id,
    displayName: def.display_name,
    description: def.description,
    category: def.category,
    businessProblem: def.business_problem,
    whyItMatters: def.why_it_matters,
    requiredIntegrations: def.required_integrations_json,
    requiredSignalKeys: def.required_signal_keys_json,
    optionalSignalKeys: def.optional_signal_keys_json,
    evaluationMode: def.evaluation_mode,
    evaluationWindow: def.evaluation_window_json,
    thresholdDefaults: def.threshold_defaults_json,
    defaultSeverity: def.default_severity,
    defaultPriorityBand: def.default_priority_band,
    status: def.status,
  });
}
