/**
 * Phase 1 — POST /api/integrations/mappings/:id/activate (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const { id } = await params;

    const { data: existing } = await ctx.supabase
      .from("integration_mappings")
      .select("id, org_id, provider_key, source_object_type")
      .eq("id", id)
      .maybeSingle();

    if (!existing || (existing as { org_id: string }).org_id !== ctx.orgId) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    const rec = existing as { provider_key: string; source_object_type: string };

    // Deactivate other mappings for same org/provider/object
    await ctx.supabase
      .from("integration_mappings")
      .update({ is_active: false })
      .eq("org_id", ctx.orgId)
      .eq("provider_key", rec.provider_key)
      .eq("source_object_type", rec.source_object_type);

    const { error } = await ctx.supabase
      .from("integration_mappings")
      .update({ is_active: true, status: "active" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
