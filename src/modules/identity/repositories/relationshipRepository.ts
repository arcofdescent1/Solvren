/**
 * Phase 2 — canonical_relationships repository (§8.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRelationshipType } from "../types";

export type CanonicalRelationshipRow = {
  id: string;
  org_id: string;
  from_entity_id: string;
  relationship_type: CanonicalRelationshipType | string;
  to_entity_id: string;
  directionality: string;
  confidence_score: number;
  source_type: string;
  source_ref: string | null;
  relationship_attributes_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

export async function getRelationshipsByEntityId(
  supabase: SupabaseClient,
  entityId: string,
  activeOnly = true
): Promise<{ data: CanonicalRelationshipRow[]; error: Error | null }> {
  let q = supabase
    .from("canonical_relationships")
    .select("*")
    .or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`);
  if (activeOnly) q = q.is("ended_at", null);
  const { data, error } = await q;
  return { data: (data ?? []) as CanonicalRelationshipRow[], error: error as Error | null };
}

export async function getActiveRelationship(
  supabase: SupabaseClient,
  orgId: string,
  fromEntityId: string,
  toEntityId: string,
  relationshipType: string
): Promise<{ data: CanonicalRelationshipRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("canonical_relationships")
    .select("*")
    .eq("org_id", orgId)
    .eq("from_entity_id", fromEntityId)
    .eq("to_entity_id", toEntityId)
    .eq("relationship_type", relationshipType)
    .is("ended_at", null)
    .maybeSingle();
  return { data: data as CanonicalRelationshipRow | null, error: error as Error | null };
}

export async function insertCanonicalRelationship(
  supabase: SupabaseClient,
  row: Omit<CanonicalRelationshipRow, "id" | "created_at" | "updated_at">
): Promise<{ data: CanonicalRelationshipRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("canonical_relationships")
    .insert({ ...row, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as CanonicalRelationshipRow | null, error: error as Error | null };
}

export async function endRelationship(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("canonical_relationships")
    .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
