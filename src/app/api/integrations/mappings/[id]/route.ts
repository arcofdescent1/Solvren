/**
 * Phase 1 — PATCH /api/integrations/mappings/:id (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function PATCH(
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
      .select("id, org_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing || (existing as { org_id: string }).org_id !== ctx.orgId) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, fields, canonical_object_type } = body as {
      status?: "draft" | "active" | "archived";
      canonical_object_type?: string;
      fields?: Array<{ source_path: string; canonical_field: string; transform_chain?: unknown[]; default_value?: string | null }>;
    };

    const updates: Record<string, unknown> = {};
    if (status != null) updates.status = status;
    if (canonical_object_type != null) updates.canonical_object_type = canonical_object_type;

    if (Object.keys(updates).length > 0) {
      const { error } = await ctx.supabase
        .from("integration_mappings")
        .update(updates)
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Array.isArray(fields)) {
      await ctx.supabase.from("integration_mapping_fields").delete().eq("mapping_id", id);
      if (fields.length > 0) {
        const rows = fields.map((f: { source_path: string; canonical_field: string; transform_chain?: unknown[]; default_value?: string | null }) => ({
          mapping_id: id,
          source_path: f.source_path,
          canonical_field: f.canonical_field,
          transform_chain: f.transform_chain ?? [],
          default_value: f.default_value ?? null,
        }));
        await ctx.supabase.from("integration_mapping_fields").insert(rows);
      }
    }

    const { data: updated } = await ctx.supabase
      .from("integration_mappings")
      .select("*")
      .eq("id", id)
      .single();

    const { data: fieldRows } = await ctx.supabase
      .from("integration_mapping_fields")
      .select("source_path, canonical_field, transform_chain, default_value")
      .eq("mapping_id", id);

    return NextResponse.json({ ok: true, mapping: { ...updated, fields: fieldRows ?? [] } });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
