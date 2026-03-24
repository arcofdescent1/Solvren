/**
 * Phase 4 — GET /api/admin/detectors/packs (§17.1).
 */
import { NextResponse } from "next/server";
import { listDetectorPacks } from "@/modules/detection/persistence/detector-packs.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET() {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { data: packs, error } = await listDetectorPacks(ctx.supabase, "active");
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
