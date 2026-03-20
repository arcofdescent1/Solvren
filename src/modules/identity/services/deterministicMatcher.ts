/**
 * Phase 2 — Deterministic matching rules (§10.2). First-class, explainable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEntityType, MatchStrategy } from "../types";
import { getLinkByExternal } from "../repositories/entityLinkRepository";
import { listCanonicalEntities } from "../repositories/canonicalEntityRepository";
import { normalizeEmail } from "./normalizationService";

export type DeterministicMatchResult = {
  matched: boolean;
  canonicalEntityId: string | null;
  entityType: CanonicalEntityType | null;
  confidence: number;
  strategy: MatchStrategy | null;
  reasons: string[];
};

/** Check for existing link: same provider + external object type + external id. */
export async function matchByExistingLink(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalObjectType: string,
  externalId: string
): Promise<DeterministicMatchResult> {
  const { data: link } = await getLinkByExternal(supabase, orgId, provider, externalObjectType, externalId);
  if (link) {
    return {
      matched: true,
      canonicalEntityId: link.canonical_entity_id,
      entityType: link.canonical_entity_id ? (link as { entity_type?: string }).entity_type as CanonicalEntityType ?? null : null,
      confidence: 1,
      strategy: "deterministic_external_reference",
      reasons: ["Existing link for this provider and external id"],
    };
  }
  return { matched: false, canonicalEntityId: null, entityType: null, confidence: 0, strategy: null, reasons: [] };
}

/** Person: exact normalized primary email match. */
export async function matchPersonByExactEmail(
  supabase: SupabaseClient,
  orgId: string,
  email: string
): Promise<DeterministicMatchResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { matched: false, canonicalEntityId: null, entityType: null, confidence: 0, strategy: null, reasons: [] };

  const { data: entities } = await listCanonicalEntities(supabase, {
    orgId,
    entityType: "person",
    status: "active",
    limit: 500,
  });
  const preferredKey = "normalized_email";
  for (const e of entities) {
    const preferred = (e.preferred_attributes_json ?? {}) as Record<string, unknown>;
    const entityEmail = (preferred[preferredKey] ?? preferred.email) as string | undefined;
    if (entityEmail === normalized) {
      return {
        matched: true,
        canonicalEntityId: e.id,
        entityType: "person",
        confidence: 1,
        strategy: "deterministic_exact_email",
        reasons: ["Exact normalized email match"],
      };
    }
  }
  return { matched: false, canonicalEntityId: null, entityType: null, confidence: 0, strategy: null, reasons: [] };
}
