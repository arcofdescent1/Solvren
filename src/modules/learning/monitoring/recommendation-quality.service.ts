/**
 * Phase 6 — Recommendation acceptance / rejection rates (review health).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listSuggestionsForOrg } from "../repositories/governance-suggestions.repository";

export type RecommendationQualitySummary = {
  total: number;
  accepted: number;
  rejected: number;
  draft: number;
  acceptanceRate: number | null;
};

export async function computeRecommendationQuality(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: RecommendationQualitySummary | null; error: Error | null }> {
  const { data: rows, error } = await listSuggestionsForOrg(supabase, orgId, { limit: 500 });
  if (error) return { data: null, error };

  let accepted = 0;
  let rejected = 0;
  let draft = 0;
  for (const r of rows) {
    if (r.status === "ACCEPTED") accepted++;
    else if (r.status === "REJECTED") rejected++;
    else if (r.status === "DRAFT" || r.status === "REVIEWED") draft++;
  }
  const decided = accepted + rejected;
  return {
    data: {
      total: rows.length,
      accepted,
      rejected,
      draft,
      acceptanceRate: decided > 0 ? accepted / decided : null,
    },
    error: null,
  };
}
