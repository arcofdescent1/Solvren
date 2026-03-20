/**
 * Phase 5 — GET /api/admin/impact/models (§18.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listImpactModels } from "@/modules/impact/persistence/impact-models.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const issueFamily = searchParams.get("issueFamily") ?? undefined;

  const { data: models, error } = await listImpactModels(supabase, { issueFamily });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      modelKey: m.model_key,
      modelVersion: m.model_version,
      displayName: m.display_name,
      issueFamily: m.issue_family,
      detectorKeys: Array.isArray(m.detector_keys_json) ? m.detector_keys_json : [],
      description: m.description,
      status: m.status,
    })),
  });
}
