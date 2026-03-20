/**
 * Phase 2 — canonical_entities repository (§8.1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalEntityType } from "../types";

export type CanonicalEntityRow = {
  id: string;
  org_id: string;
  entity_type: CanonicalEntityType | string;
  display_name: string | null;
  canonical_key: string | null;
  preferred_attributes_json: Record<string, unknown>;
  source_summary_json: Record<string, unknown>;
  status: string;
  merge_parent_id: string | null;
  created_by_type: string;
  created_by_ref: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export async function getCanonicalEntityById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: CanonicalEntityRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("canonical_entities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as CanonicalEntityRow | null, error: error as Error | null };
}

export async function listCanonicalEntities(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    entityType?: CanonicalEntityType | string;
    status?: string;
    limit?: number;
    offset?: number;
    q?: string;
  }
): Promise<{ data: CanonicalEntityRow[]; error: Error | null }> {
  let q = supabase
    .from("canonical_entities")
    .select("*")
    .eq("org_id", params.orgId);
  if (params.entityType) q = q.eq("entity_type", params.entityType);
  if (params.status) q = q.eq("status", params.status);
  if (params.q?.trim()) {
    q = q.or(`display_name.ilike.%${params.q.trim().replace(/'/g, "''")}%,canonical_key.ilike.%${params.q.trim().replace(/'/g, "''")}%`);
  }
  q = q.order("updated_at", { ascending: false });
  const limit = Math.min(100, params.limit ?? 20);
  const offset = params.offset ?? 0;
  const { data, error } = await q.range(offset, offset + limit - 1);
  return { data: (data ?? []) as CanonicalEntityRow[], error: error as Error | null };
}

export async function insertCanonicalEntity(
  supabase: SupabaseClient,
  row: Omit<CanonicalEntityRow, "id" | "created_at" | "updated_at">
): Promise<{ data: CanonicalEntityRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("canonical_entities")
    .insert({ ...row, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as CanonicalEntityRow | null, error: error as Error | null };
}

export async function updateCanonicalEntity(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<CanonicalEntityRow, "display_name" | "canonical_key" | "preferred_attributes_json" | "source_summary_json" | "status" | "merge_parent_id" | "archived_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("canonical_entities")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
