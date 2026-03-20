/**
 * Phase 3 — Entity linking via Phase 2 identity (§11).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityCandidate } from "../domain/types";
import { resolveExternalObject } from "@/modules/identity";

export type EntityLinkResult = {
  primaryCanonicalEntityId: string | null;
  linkedEntityIds: string[];
};

export async function resolveEntityCandidates(
  supabase: SupabaseClient,
  orgId: string,
  integrationAccountId: string | null,
  candidates: EntityCandidate[]
): Promise<EntityLinkResult> {
  if (candidates.length === 0) return { primaryCanonicalEntityId: null, linkedEntityIds: [] };

  const linkedEntityIds: string[] = [];
  let primaryCanonicalEntityId: string | null = null;

  for (const c of candidates) {
    const result = await resolveExternalObject(supabase, {
      orgId,
      provider: c.provider,
      objectType: c.externalObjectType,
      externalId: c.externalId,
      payload: {},
      integrationAccountId,
      observedAt: new Date().toISOString(),
    });
    if (result.canonicalEntityId) {
      linkedEntityIds.push(result.canonicalEntityId);
      if (!primaryCanonicalEntityId && c.confidence >= 0.8) {
        primaryCanonicalEntityId = result.canonicalEntityId;
      }
    }
  }
  if (!primaryCanonicalEntityId && linkedEntityIds.length > 0) {
    primaryCanonicalEntityId = linkedEntityIds[0];
  }
  return { primaryCanonicalEntityId, linkedEntityIds };
}
