/**
 * Phase 1 — GET/POST /api/integrations/mappings (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");

    const { data: mappings, error } = await ctx.supabase
      .from("integration_mappings")
      .select(`
        id, org_id, provider_key, source_object_type, canonical_object_type,
        template_id, version, status, is_active, created_at, updated_at
      `)
      .eq("org_id", ctx.orgId)
      .order("provider_key")
      .order("source_object_type");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const withFields = await Promise.all(
      (mappings ?? []).map(async (m) => {
        const { data: fields } = await ctx.supabase
          .from("integration_mapping_fields")
          .select("source_path, canonical_field, transform_chain, default_value")
          .eq("mapping_id", (m as { id: string }).id);
        return { ...m, fields: fields ?? [] };
      })
    );

    return NextResponse.json({ ok: true, mappings: withFields });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const body = await req.json();
    const {
      provider_key,
      source_object_type,
      canonical_object_type,
      template_id,
      fields,
    } = body as {
      provider_key?: string;
      source_object_type?: string;
      canonical_object_type?: string;
      template_id?: string | null;
      fields?: Array<{ source_path: string; canonical_field: string; transform_chain?: unknown[]; default_value?: string | null }>;
    };

    if (!provider_key || !source_object_type || !canonical_object_type) {
      return NextResponse.json(
        { error: "provider_key, source_object_type, canonical_object_type required" },
        { status: 400 }
      );
    }
    if (!hasProvider(provider_key)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const { data: mapping, error: insertErr } = await ctx.supabase
      .from("integration_mappings")
      .insert({
        org_id: ctx.orgId,
        provider_key,
        source_object_type,
        canonical_object_type,
        template_id: template_id || null,
        version: 1,
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
      source_path: f.source_path,
      canonical_field: f.canonical_field,
      transform_chain: f.transform_chain ?? [],
      default_value: f.default_value ?? null,
    }));

    if (fieldRows.length > 0) {
      await ctx.supabase.from("integration_mapping_fields").insert(fieldRows);
    }

    return NextResponse.json({ ok: true, mapping: { id: mappingId, ...body } });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
