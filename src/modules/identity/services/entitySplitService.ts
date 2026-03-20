/**
 * Phase 2 — Split entity (§14.6). Create new entity and move selected links.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEntityType } from "../types";
import { getCanonicalEntityById, insertCanonicalEntity } from "../repositories/canonicalEntityRepository";
import { getLinksByCanonicalEntityId } from "../repositories/entityLinkRepository";
import { updateEntityLink } from "../repositories/entityLinkRepository";
import { insertEntityLink } from "../repositories/entityLinkRepository";
import { insertResolutionEvent } from "../repositories/resolutionEventRepository";

export async function splitEntity(
  supabase: SupabaseClient,
  params: {
    entityId: string;
    linkIdsToMove: string[];
    newEntityAttributes: { displayName?: string };
    orgId: string;
    userId: string;
    notes?: string | null;
  }
): Promise<{ ok: boolean; newEntityId?: string; error?: string }> {
  const { data: source } = await getCanonicalEntityById(supabase, params.entityId);
  if (!source || source.org_id !== params.orgId) return { ok: false, error: "Entity not found" };

  const { data: newEntity, error: createErr } = await insertCanonicalEntity(supabase, {
    org_id: params.orgId,
    entity_type: source.entity_type as CanonicalEntityType,
    display_name: params.newEntityAttributes.displayName ?? "Split entity",
    canonical_key: null,
    preferred_attributes_json: {},
    source_summary_json: { split_from: params.entityId },
    status: "active",
    merge_parent_id: null,
    created_by_type: "user",
    created_by_ref: params.userId,
    archived_at: null,
  });
  if (createErr || !newEntity) return { ok: false, error: createErr?.message ?? "Failed to create entity" };

  const linkIdSet = new Set(params.linkIdsToMove);
  const { data: links } = await getLinksByCanonicalEntityId(supabase, params.entityId, true);
  for (const link of links) {
    if (!linkIdSet.has(link.id)) continue;
    await updateEntityLink(supabase, link.id, { link_status: "unlinked", unlinked_at: new Date().toISOString() });
    await insertEntityLink(supabase, {
      org_id: params.orgId,
      canonical_entity_id: newEntity.id,
      provider: link.provider,
      integration_account_id: link.integration_account_id,
      external_object_type: link.external_object_type,
      external_id: link.external_id,
      external_key: link.external_key,
      link_status: "linked",
      confidence_score: link.confidence_score,
      match_strategy: link.match_strategy,
      match_reasons_json: link.match_reasons_json,
      linked_by_type: "user",
      linked_by_ref: params.userId,
      unlinked_at: null,
    });
  }

  await insertResolutionEvent(supabase, {
    org_id: params.orgId,
    event_type: "entity_split",
    canonical_entity_id: newEntity.id,
    related_entity_id: params.entityId,
    actor_type: "user",
    actor_ref: params.userId,
    event_payload_json: { linkIdsToMove: params.linkIdsToMove, notes: params.notes },
  });
  return { ok: true, newEntityId: newEntity.id };
}
