/**
 * Phase 2 — Merge entities (§14.5). Move links to target, archive sources.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCanonicalEntityById, updateCanonicalEntity } from "../repositories/canonicalEntityRepository";
import { getLinksByCanonicalEntityId } from "../repositories/entityLinkRepository";
import { insertEntityLink } from "../repositories/entityLinkRepository";
import { updateEntityLink } from "../repositories/entityLinkRepository";
import { insertResolutionEvent } from "../repositories/resolutionEventRepository";

export async function mergeEntities(
  supabase: SupabaseClient,
  params: {
    sourceEntityIds: string[];
    targetEntityId: string;
    orgId: string;
    userId: string;
    notes?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data: target } = await getCanonicalEntityById(supabase, params.targetEntityId);
  if (!target || target.org_id !== params.orgId) return { ok: false, error: "Target entity not found" };

  for (const sourceId of params.sourceEntityIds) {
    if (sourceId === params.targetEntityId) continue;
    const { data: source } = await getCanonicalEntityById(supabase, sourceId);
    if (!source || source.org_id !== params.orgId) continue;

    const { data: links } = await getLinksByCanonicalEntityId(supabase, sourceId, true);
    for (const link of links) {
      await updateEntityLink(supabase, link.id, { link_status: "unlinked", unlinked_at: new Date().toISOString() });
      await insertEntityLink(supabase, {
        org_id: params.orgId,
        canonical_entity_id: params.targetEntityId,
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
    await updateCanonicalEntity(supabase, sourceId, {
      status: "archived",
      merge_parent_id: params.targetEntityId,
      archived_at: new Date().toISOString(),
    });
  }

  await insertResolutionEvent(supabase, {
    org_id: params.orgId,
    event_type: "entities_merged",
    canonical_entity_id: params.targetEntityId,
    related_entity_id: null,
    actor_type: "user",
    actor_ref: params.userId,
    event_payload_json: { sourceEntityIds: params.sourceEntityIds, notes: params.notes },
  });
  return { ok: true };
}
