/**
 * Phase 1 — POST /api/integrations/mappings/from-template (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const body = await req.json();
    const { template_id, provider_key, source_object_type } = body as {
      template_id: string;
      provider_key?: string;
      source_object_type?: string;
    };

    if (!template_id) return NextResponse.json({ error: "template_id required" }, { status: 400 });

    const { data: template, error: tErr } = await ctx.supabase
      .from("integration_mapping_templates")
      .select("id, provider_key, source_object_type, canonical_object_type, version")
      .eq("id", template_id)
      .eq("is_active", true)
      .maybeSingle();

    if (tErr || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const t = template as { provider_key: string; source_object_type: string; canonical_object_type: string };
    const finalProvider = provider_key ?? t.provider_key;
    const finalSourceObject = source_object_type ?? t.source_object_type;

    const { data: fields } = await ctx.supabase
      .from("integration_mapping_template_fields")
      .select("source_path, canonical_field, transform_chain, default_value")
      .eq("template_id", template_id);

    const { data: mapping, error: insertErr } = await ctx.supabase
      .from("integration_mappings")
      .insert({
        org_id: ctx.orgId,
        provider_key: finalProvider,
        source_object_type: finalSourceObject,
        canonical_object_type: t.canonical_object_type,
        template_id: template_id,
        version: (template as { version: number }).version,
        status: "draft",
        is_active: false,
      })
      .select("id")
      .single();

    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "Mapping already exists for this provider/object" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const mappingId = (mapping as { id: string }).id;
    const fieldRows = (fields ?? []).map((f: { source_path: string; canonical_field: string; transform_chain?: unknown[]; default_value?: string | null }) => ({
      mapping_id: mappingId,
      source_path: (f as { source_path: string }).source_path,
      canonical_field: (f as { canonical_field: string }).canonical_field,
      transform_chain: ((f as { transform_chain?: unknown[] }).transform_chain) ?? [],
      default_value: (f as { default_value?: string | null }).default_value ?? null,
    }));

    if (fieldRows.length > 0) {
      await ctx.supabase.from("integration_mapping_fields").insert(fieldRows);
    }

    return NextResponse.json({
      ok: true,
      mapping: {
        id: mappingId,
        provider_key: finalProvider,
        source_object_type: finalSourceObject,
        canonical_object_type: t.canonical_object_type,
        template_id,
        status: "draft",
        is_active: false,
        fields: fieldRows,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
