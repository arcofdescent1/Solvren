/**
 * Phase 2 — entity_attribute_values repository (§8.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityAttributeValueRow = {
  id: string;
  org_id: string;
  canonical_entity_id: string;
  attribute_key: string;
  attribute_value_json: unknown;
  provider: string;
  external_object_type: string;
  external_id: string;
  is_preferred: boolean;
  precedence_rank: number;
  confidence_score: number;
  observed_at: string;
  created_at: string;
};

export async function getAttributeValuesByEntity(
  supabase: SupabaseClient,
  canonicalEntityId: string,
  attributeKey?: string
): Promise<{ data: EntityAttributeValueRow[]; error: Error | null }> {
  let q = supabase
    .from("entity_attribute_values")
    .select("*")
    .eq("canonical_entity_id", canonicalEntityId);
  if (attributeKey) q = q.eq("attribute_key", attributeKey);
  q = q.order("precedence_rank", { ascending: true });
  const { data, error } = await q;
  return { data: (data ?? []) as EntityAttributeValueRow[], error: error as Error | null };
}

export async function insertAttributeValue(
  supabase: SupabaseClient,
  row: Omit<EntityAttributeValueRow, "id" | "created_at">
): Promise<{ data: EntityAttributeValueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_attribute_values")
    .insert(row)
    .select()
    .single();
  return { data: data as EntityAttributeValueRow | null, error: error as Error | null };
}
