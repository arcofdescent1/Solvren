/**
 * Phase 2 — Recompute preferred attributes for entity/org (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAttributeValuesByEntity } from "../repositories/attributeValueRepository";
import { listCanonicalEntities, updateCanonicalEntity } from "../repositories/canonicalEntityRepository";

export type RecomputePreferredAttributesInput = {
  orgId: string;
  entityId?: string;
  limit?: number;
};

export type RecomputePreferredAttributesResult = {
  updated: number;
  errors: number;
};

/** Build preferred_attributes_json from entity_attribute_values (best value per key by precedence). */
function mergePreferredFromAttributeValues(
  rows: { attribute_key: string; attribute_value_json: unknown; is_preferred: boolean; precedence_rank: number }[]
): Record<string, unknown> {
  const byKey = new Map<string, { value: unknown; rank: number; preferred: boolean }>();
  for (const r of rows) {
    const existing = byKey.get(r.attribute_key);
    const rank = r.is_preferred ? 0 : r.precedence_rank;
    if (!existing || (r.is_preferred && !existing.preferred) || (rank < existing.rank && !existing.preferred))
      byKey.set(r.attribute_key, { value: r.attribute_value_json, rank, preferred: r.is_preferred });
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of byKey) out[k] = v.value;
  return out;
}

export async function runRecomputePreferredAttributesJob(
  supabase: SupabaseClient,
  input: RecomputePreferredAttributesInput
): Promise<RecomputePreferredAttributesResult> {
  const limit = input.limit ?? 500;
  let updated = 0;
  let errors = 0;

  if (input.entityId) {
    const { data: rows } = await getAttributeValuesByEntity(supabase, input.entityId);
    const preferred = mergePreferredFromAttributeValues(rows);
    const { error } = await updateCanonicalEntity(supabase, input.entityId, {
      preferred_attributes_json: preferred,
    });
    if (error) errors++;
    else updated++;
    return { updated, errors };
  }

  const { data: entities } = await listCanonicalEntities(supabase, {
    orgId: input.orgId,
    status: "active",
    limit,
  });
  for (const e of entities) {
    const { data: rows } = await getAttributeValuesByEntity(supabase, e.id);
    if (rows.length === 0) continue;
    const preferred = mergePreferredFromAttributeValues(rows);
    const { error } = await updateCanonicalEntity(supabase, e.id, {
      preferred_attributes_json: preferred,
    });
    if (error) errors++;
    else updated++;
  }
  return { updated, errors };
}
