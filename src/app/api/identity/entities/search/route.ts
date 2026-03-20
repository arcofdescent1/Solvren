/**
 * Phase 2 — GET /api/identity/entities/search (§14.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchEntities } from "@/modules/identity/services/searchEntities";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  if (!orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(orgId)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const { data: entities, error } = await searchEntities(supabase, {
    orgId,
    entityType,
    status,
    q,
    limit,
    offset,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: entities.map((e) => ({
      id: e.id,
      entityType: e.entity_type,
      displayName: e.display_name,
      canonicalKey: e.canonical_key,
      preferredAttributes: e.preferred_attributes_json,
      status: e.status,
      updatedAt: e.updated_at,
    })),
    meta: { timestamp: new Date().toISOString() },
  });
}
