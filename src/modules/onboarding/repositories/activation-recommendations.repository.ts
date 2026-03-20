/**
 * Phase 10 — activation_recommendations repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivationRecommendation } from "../domain";

export type ActivationRecommendationRow = {
  id: string;
  org_id: string;
  recommendation_type: string;
  target_key: string;
  title: string;
  description: string;
  recommendation_status: string;
  confidence_score: number;
  evidence_json: unknown;
  created_at: string;
  updated_at: string;
};

export async function listActivationRecommendations(
  supabase: SupabaseClient,
  orgId: string,
  options?: { status?: string }
): Promise<{ data: ActivationRecommendation[]; error: Error | null }> {
  let q = supabase
    .from("activation_recommendations")
    .select("*")
    .eq("org_id", orgId)
    .order("confidence_score", { ascending: false });

  if (options?.status) {
    q = q.eq("recommendation_status", options.status);
  } else {
    q = q.eq("recommendation_status", "OPEN");
  }

  const { data, error } = await q.limit(20);
  if (error) return { data: [], error: error as Error };

  const rows = (data ?? []) as ActivationRecommendationRow[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      recommendationType: r.recommendation_type as ActivationRecommendation["recommendationType"],
      targetKey: r.target_key,
      title: r.title,
      description: r.description,
      recommendationStatus: r.recommendation_status as ActivationRecommendation["recommendationStatus"],
      confidenceScore: r.confidence_score,
      evidenceJson: (r.evidence_json ?? {}) as Record<string, unknown>,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    error: null,
  };
}
