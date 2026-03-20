/**
 * Phase 2 — Unlink external object (§14.7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateEntityLink } from "../repositories/entityLinkRepository";
import { insertResolutionEvent } from "../repositories/resolutionEventRepository";

export async function unlinkExternalObject(
  supabase: SupabaseClient,
  params: {
    linkId: string;
    orgId: string;
    reason?: string | null;
    userId: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data: link } = await supabase
    .from("entity_links")
    .select("id, org_id, canonical_entity_id")
    .eq("id", params.linkId)
    .single();
  if (!link || (link as { org_id: string }).org_id !== params.orgId) {
    return { ok: false, error: "Link not found" };
  }

  await updateEntityLink(supabase, params.linkId, {
    link_status: "unlinked",
    unlinked_at: new Date().toISOString(),
  });
  await insertResolutionEvent(supabase, {
    org_id: params.orgId,
    event_type: "link_unlinked",
    canonical_entity_id: (link as { canonical_entity_id: string }).canonical_entity_id,
    related_entity_id: null,
    link_id: params.linkId,
    candidate_id: null,
    actor_type: "user",
    actor_ref: params.userId,
    event_payload_json: { reason: params.reason ?? null },
  });
  return { ok: true };
}
