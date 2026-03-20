/**
 * Phase 2 — Relationship resolver (§13). Create canonical_relationships from linked entities.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRelationshipType } from "../types";
import {
  insertCanonicalRelationship,
  getActiveRelationship,
} from "../repositories/relationshipRepository";
import { listCanonicalEntities } from "../repositories/canonicalEntityRepository";
import { normalizeDomain } from "./normalizationService";

/** Idempotent: ensure one active relationship exists; create if missing. */
export async function ensureCanonicalRelationship(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    fromEntityId: string;
    toEntityId: string;
    relationshipType: CanonicalRelationshipType | string;
    sourceType: string;
    sourceRef?: string | null;
    confidenceScore?: number;
  }
): Promise<{ created: boolean; error: Error | null }> {
  const { orgId, fromEntityId, toEntityId, relationshipType, sourceType, sourceRef, confidenceScore = 1 } = params;
  const { data: existing } = await getActiveRelationship(
    supabase,
    orgId,
    fromEntityId,
    toEntityId,
    relationshipType
  );
  if (existing) return { created: false, error: null };

  const { error } = await insertCanonicalRelationship(supabase, {
    org_id: orgId,
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
    relationship_type: relationshipType,
    directionality: "directed",
    confidence_score: confidenceScore,
    source_type: sourceType,
    source_ref: sourceRef ?? null,
    relationship_attributes_json: {},
    ended_at: null,
  });
  return { created: !error, error: error as Error | null };
}

/** Rebuild person->company belongs_to from preferred_attributes company_domain. */
export async function rebuildRelationshipsForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ created: number; errors: number }> {
  const { data: persons } = await listCanonicalEntities(supabase, {
    orgId,
    entityType: "person",
    status: "active",
    limit: 500,
  });
  const { data: companies } = await listCanonicalEntities(supabase, {
    orgId,
    entityType: "company",
    status: "active",
    limit: 500,
  });
  const domainToCompany = new Map<string, string>();
  for (const c of companies) {
    const pref = (c.preferred_attributes_json ?? {}) as Record<string, unknown>;
    const domain = (pref.website_domain ?? pref.company_domain ?? pref.domain) as string | undefined;
    const norm = domain ? normalizeDomain(domain) : null;
    if (norm) domainToCompany.set(norm, c.id);
  }

  let created = 0;
  let errors = 0;
  for (const p of persons) {
    const pref = (p.preferred_attributes_json ?? {}) as Record<string, unknown>;
    const domain = (pref.company_domain ?? pref.website_domain ?? pref.domain) as string | undefined;
    const norm = domain ? normalizeDomain(domain) : null;
    if (!norm) continue;
    const companyId = domainToCompany.get(norm);
    if (!companyId || companyId === p.id) continue;

    const { created: ok, error } = await ensureCanonicalRelationship(supabase, {
      orgId,
      fromEntityId: p.id,
      toEntityId: companyId,
      relationshipType: "belongs_to",
      sourceType: "attribute_inference",
      sourceRef: "rebuildRelationshipsForOrg",
    });
    if (ok) created++;
    if (error) errors++;
  }
  return { created, errors };
}
