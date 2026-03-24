/**
 * Phase 1 — GET /api/integrations/mapping-templates (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");

    const providerKey = req.nextUrl.searchParams.get("providerKey");
    const sourceObjectType = req.nextUrl.searchParams.get("sourceObjectType");

    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("integration_mapping_templates")
      .select("id, provider_key, source_object_type, canonical_object_type, name, version, is_active")
      .eq("is_active", true);

    if (providerKey) query = query.eq("provider_key", providerKey);
    if (sourceObjectType) query = query.eq("source_object_type", sourceObjectType);

    const { data: templates, error } = await query.order("provider_key").order("source_object_type");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const withFields = await Promise.all(
      (templates ?? []).map(async (t) => {
        const { data: fields } = await supabase
          .from("integration_mapping_template_fields")
          .select("source_path, canonical_field, transform_chain, default_value")
          .eq("template_id", (t as { id: string }).id);
        return { ...t, fields: fields ?? [] };
      })
    );

    return NextResponse.json({ ok: true, templates: withFields });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
