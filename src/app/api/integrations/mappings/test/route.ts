/**
 * Phase 1 — POST /api/integrations/mappings/test (§10).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { executeMapping, executeMappingWithConfig } from "@/lib/integrations/mapping/executeMapping";
import type { MappingConfig } from "@/lib/integrations/mapping/types";
import type { TransformSpec } from "@/lib/integrations/mapping/transformEngine";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId?.trim()) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const body = await req.json();
    const { mapping_id, payload, provider_key, source_object_type, canonical_object_type, fields } = body as {
      mapping_id?: string;
      payload: unknown;
      provider_key?: string;
      source_object_type?: string;
      canonical_object_type?: string;
      fields?: Array<{ source_path: string; canonical_field: string; transform_chain?: TransformSpec[]; default_value?: string | null }>;
    };

    if (!payload) return NextResponse.json({ error: "payload required" }, { status: 400 });

    if (mapping_id) {
      const { data: mapping } = await ctx.supabase
        .from("integration_mappings")
        .select("id, org_id, provider_key, source_object_type")
        .eq("id", mapping_id)
        .maybeSingle();

      if (!mapping || (mapping as { org_id: string }).org_id !== ctx.orgId) {
        return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
      }

      const m = mapping as { provider_key: string; source_object_type: string };
      const result = await executeMapping({
        orgId: ctx.orgId,
        providerKey: m.provider_key,
        sourceObjectType: m.source_object_type,
        payload,
        supabase: ctx.supabase,
        persistRun: true,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (!provider_key || !source_object_type || !canonical_object_type || !fields?.length) {
      return NextResponse.json(
        { error: "provider_key, source_object_type, canonical_object_type, and fields required when mapping_id not provided" },
        { status: 400 }
      );
    }

    const config: MappingConfig = {
      id: "",
      org_id: ctx.orgId,
      provider_key,
      source_object_type,
      canonical_object_type,
      version: 1,
      fields: fields.map((f) => ({
        source_path: f.source_path,
        canonical_field: f.canonical_field,
        transform_chain: f.transform_chain ?? [],
        default_value: f.default_value ?? null,
      })),
    };

    const result = executeMappingWithConfig(config, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
