/**
 * Phase 2 — GET /api/identity/entities/:id (§14.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCanonicalEntityById } from "@/modules/identity/repositories/canonicalEntityRepository";
import { getLinksByCanonicalEntityId } from "@/modules/identity/repositories/entityLinkRepository";
import { getRelationshipsByEntityId } from "@/modules/identity/repositories/relationshipRepository";
import { getResolutionEventsByEntity } from "@/modules/identity/repositories/resolutionEventRepository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;
  const { data: entity, error: entityErr } = await getCanonicalEntityById(supabase, id);
  if (entityErr || !entity) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Entity not found" } }, { status: 404 });
  }

  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(entity.org_id)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const [linksRes, relationshipsRes, eventsRes] = await Promise.all([
    getLinksByCanonicalEntityId(supabase, id, true),
    getRelationshipsByEntityId(supabase, id, true),
    getResolutionEventsByEntity(supabase, id, 20),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      entity: {
        id: entity.id,
        orgId: entity.org_id,
        entityType: entity.entity_type,
        displayName: entity.display_name,
        canonicalKey: entity.canonical_key,
        preferredAttributes: entity.preferred_attributes_json,
        sourceSummary: entity.source_summary_json,
        status: entity.status,
        mergeParentId: entity.merge_parent_id,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      links: linksRes.data,
      relationships: relationshipsRes.data,
      resolutionHistory: eventsRes.data,
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
