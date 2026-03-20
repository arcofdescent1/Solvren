/**
 * Phase 2 — entity_links repository (§8.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkStatus, MatchStrategy } from "../types";

export type EntityLinkRow = {
  id: string;
  org_id: string;
  canonical_entity_id: string;
  provider: string;
  integration_account_id: string | null;
  external_object_type: string;
  external_id: string;
  external_key: string | null;
  link_status: LinkStatus;
  confidence_score: number;
  match_strategy: MatchStrategy | string;
  match_reasons_json: string[];
  linked_by_type: string;
  linked_by_ref: string | null;
  created_at: string;
  updated_at: string;
  unlinked_at: string | null;
};

export async function getLinkByExternal(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  externalObjectType: string,
  externalId: string
): Promise<{ data: EntityLinkRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_links")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("external_object_type", externalObjectType)
    .eq("external_id", externalId)
    .eq("link_status", "linked")
    .maybeSingle();
  return { data: data as EntityLinkRow | null, error: error as Error | null };
}

export async function getLinksByCanonicalEntityId(
  supabase: SupabaseClient,
  canonicalEntityId: string,
  linkedOnly = true
): Promise<{ data: EntityLinkRow[]; error: Error | null }> {
  let q = supabase
    .from("entity_links")
    .select("*")
    .eq("canonical_entity_id", canonicalEntityId);
  if (linkedOnly) q = q.eq("link_status", "linked");
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  return { data: (data ?? []) as EntityLinkRow[], error: error as Error | null };
}

export async function insertEntityLink(
  supabase: SupabaseClient,
  row: Omit<EntityLinkRow, "id" | "created_at" | "updated_at">
): Promise<{ data: EntityLinkRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_links")
    .insert({ ...row, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as EntityLinkRow | null, error: error as Error | null };
}

export async function updateEntityLink(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<EntityLinkRow, "link_status" | "unlinked_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("entity_links")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}

/** List distinct canonical_entity_ids where external_id matches query (§17.1). */
export async function listCanonicalEntityIdsByExternalIdSearch(
  supabase: SupabaseClient,
  orgId: string,
  q: string,
  limit = 50
): Promise<{ data: string[]; error: Error | null }> {
  const term = q.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
  if (!term) return { data: [], error: null };
  const { data, error } = await supabase
    .from("entity_links")
    .select("canonical_entity_id")
    .eq("org_id", orgId)
    .eq("link_status", "linked")
    .ilike("external_id", `%${term}%`)
    .limit(limit);
  if (error) return { data: [], error: error as Error };
  const ids = [...new Set((data ?? []).map((r) => (r as { canonical_entity_id: string }).canonical_entity_id))];
  return { data: ids, error: null };
}
