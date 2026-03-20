/**
 * Phase 2 — entity_match_candidates repository (§8.4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchCandidateReviewStatus } from "../types";

export type EntityMatchCandidateRow = {
  id: string;
  org_id: string;
  candidate_type: string;
  primary_provider: string;
  primary_object_type: string;
  primary_external_id: string;
  proposed_entity_type: string;
  proposed_canonical_entity_id: string | null;
  confidence_score: number;
  score_breakdown_json: Record<string, unknown>;
  reasons_json: string[];
  review_status: MatchCandidateReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  expires_at: string | null;
};

export async function listMatchCandidates(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    reviewStatus?: MatchCandidateReviewStatus | string;
    proposedEntityType?: string;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: EntityMatchCandidateRow[]; error: Error | null }> {
  let q = supabase
    .from("entity_match_candidates")
    .select("*")
    .eq("org_id", params.orgId);
  if (params.reviewStatus) q = q.eq("review_status", params.reviewStatus);
  if (params.proposedEntityType) q = q.eq("proposed_entity_type", params.proposedEntityType);
  if (params.minConfidence != null) q = q.gte("confidence_score", params.minConfidence);
  q = q.order("created_at", { ascending: false });
  const limit = Math.min(100, params.limit ?? 50);
  const offset = params.offset ?? 0;
  const { data, error } = await q.range(offset, offset + limit - 1);
  return { data: (data ?? []) as EntityMatchCandidateRow[], error: error as Error | null };
}

export async function getMatchCandidateById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: EntityMatchCandidateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_match_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as EntityMatchCandidateRow | null, error: error as Error | null };
}

export async function insertMatchCandidate(
  supabase: SupabaseClient,
  row: Omit<EntityMatchCandidateRow, "id" | "created_at">
): Promise<{ data: EntityMatchCandidateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("entity_match_candidates")
    .insert(row)
    .select()
    .single();
  return { data: data as EntityMatchCandidateRow | null, error: error as Error | null };
}

export async function updateMatchCandidateReview(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<EntityMatchCandidateRow, "review_status" | "reviewed_by" | "reviewed_at" | "review_notes" | "proposed_canonical_entity_id">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("entity_match_candidates")
    .update(updates)
    .eq("id", id);
  return { error: error as Error | null };
}
