/**
 * Phase 2 — entity_resolution_events repository (§8.6). Audit trail for identity actions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityResolutionEventRow = {
  id: string;
  org_id: string;
  event_type: string;
  canonical_entity_id: string | null;
  related_entity_id: string | null;
  link_id: string | null;
  candidate_id: string | null;
  actor_type: string;
  actor_ref: string | null;
  event_payload_json: Record<string, unknown>;
  created_at: string;
};

export async function insertResolutionEvent(
  supabase: SupabaseClient,
  row: Omit<EntityResolutionEventRow, "id" | "created_at">
): Promise<{ data: EntityResolutionEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_resolution_events")
    .insert(row)
    .select()
    .single();
  return { data: data as EntityResolutionEventRow | null, error: error as Error | null };
}

export async function getResolutionEventsByEntity(
  supabase: SupabaseClient,
  canonicalEntityId: string,
  limit = 50
): Promise<{ data: EntityResolutionEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_resolution_events")
    .select("*")
    .or(`canonical_entity_id.eq.${canonicalEntityId},related_entity_id.eq.${canonicalEntityId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as EntityResolutionEventRow[], error: error as Error | null };
}
