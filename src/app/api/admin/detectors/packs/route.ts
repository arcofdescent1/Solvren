/**
 * Phase 4 — GET /api/admin/detectors/packs (§17.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listDetectorPacks } from "@/modules/detection/persistence/detector-packs.repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: packs, error } = await listDetectorPacks(supabase, "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    packs: packs.map((p) => ({
      id: p.id,
      packKey: p.pack_key,
      displayName: p.display_name,
      description: p.description,
      businessTheme: p.business_theme,
      recommendedIntegrations: p.recommended_integrations_json,
    })),
  });
}
