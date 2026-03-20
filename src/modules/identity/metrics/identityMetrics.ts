/**
 * Phase 2 — Identity metrics (§17.2). Counts and rates for observability.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IdentityMetricsSnapshot = {
  orgId: string;
  at: string;
  entitiesByType: Record<string, number>;
  totalEntities: number;
  linksByProvider: Record<string, number>;
  linksByObjectType: Record<string, number>;
  totalLinks: number;
  pendingCandidates: number;
  acceptedCandidates: number;
  rejectedCandidates: number;
  meanCandidateReviewAgeHours: number | null;
  resolutionEvents: { autoLinked: number; entityCreated: number; candidateCreated: number };
  mergeCount: number;
  splitCount: number;
  avgLinkConfidence: number | null;
};

export async function getIdentityMetrics(
  supabase: SupabaseClient,
  orgId: string
): Promise<IdentityMetricsSnapshot> {
  const at = new Date().toISOString();

  const { data: entityCounts } = await supabase
    .from("canonical_entities")
    .select("entity_type")
    .eq("org_id", orgId)
    .eq("status", "active");
  const entitiesByType: Record<string, number> = {};
  for (const r of entityCounts ?? []) {
    const t = (r as { entity_type: string }).entity_type;
    entitiesByType[t] = (entitiesByType[t] ?? 0) + 1;
  }
  const totalEntities = (entityCounts ?? []).length;

  const { data: links } = await supabase
    .from("entity_links")
    .select("provider, external_object_type, confidence_score")
    .eq("org_id", orgId)
    .eq("link_status", "linked");
  const linksByProvider: Record<string, number> = {};
  const linksByObjectType: Record<string, number> = {};
  let sumConf = 0;
  let confN = 0;
  for (const r of links ?? []) {
    const row = r as { provider: string; external_object_type: string; confidence_score: number };
    linksByProvider[row.provider] = (linksByProvider[row.provider] ?? 0) + 1;
    linksByObjectType[row.external_object_type] = (linksByObjectType[row.external_object_type] ?? 0) + 1;
    if (row.confidence_score != null) {
      sumConf += Number(row.confidence_score);
      confN++;
    }
  }
  const totalLinks = links?.length ?? 0;
  const avgLinkConfidence = confN > 0 ? sumConf / confN : null;

  const { data: candidates } = await supabase
    .from("entity_match_candidates")
    .select("review_status, created_at, reviewed_at")
    .eq("org_id", orgId);
  let pendingCandidates = 0;
  let acceptedCandidates = 0;
  let rejectedCandidates = 0;
  let totalReviewAgeMs = 0;
  let reviewCount = 0;
  for (const r of candidates ?? []) {
    const row = r as { review_status: string; created_at: string; reviewed_at: string | null };
    if (row.review_status === "pending") pendingCandidates++;
    else if (row.review_status === "accepted") acceptedCandidates++;
    else if (row.review_status === "rejected") rejectedCandidates++;
    if (row.reviewed_at && row.created_at) {
      totalReviewAgeMs += new Date(row.reviewed_at).getTime() - new Date(row.created_at).getTime();
      reviewCount++;
    }
  }
  const meanCandidateReviewAgeHours = reviewCount > 0 ? totalReviewAgeMs / reviewCount / (3600 * 1000) : null;

  const { data: events } = await supabase
    .from("entity_resolution_events")
    .select("event_type")
    .eq("org_id", orgId);
  const resolutionEvents = { autoLinked: 0, entityCreated: 0, candidateCreated: 0 };
  for (const r of events ?? []) {
    const t = (r as { event_type: string }).event_type;
    if (t === "auto_linked") resolutionEvents.autoLinked++;
    else if (t === "entity_created") resolutionEvents.entityCreated++;
    else if (t === "candidate_created") resolutionEvents.candidateCreated++;
  }

  const { data: mergeEvents } = await supabase
    .from("entity_resolution_events")
    .select("id")
    .eq("org_id", orgId)
    .eq("event_type", "entities_merged");
  const mergeCount = mergeEvents?.length ?? 0;

  const { data: splitEvents } = await supabase
    .from("entity_resolution_events")
    .select("id")
    .eq("org_id", orgId)
    .eq("event_type", "entity_split");
  const splitCount = splitEvents?.length ?? 0;

  return {
    orgId,
    at,
    entitiesByType,
    totalEntities,
    linksByProvider,
    linksByObjectType,
    totalLinks,
    pendingCandidates,
    acceptedCandidates,
    rejectedCandidates,
    meanCandidateReviewAgeHours,
    resolutionEvents,
    mergeCount,
    splitCount,
    avgLinkConfidence,
  };
}

/** Alert conditions (§17.3). Return list of active alert keys. */
export function evaluateIdentityAlerts(metrics: IdentityMetricsSnapshot): string[] {
  const alerts: string[] = [];
  if (metrics.pendingCandidates > 100) alerts.push("candidate_backlog_high");
  if (metrics.meanCandidateReviewAgeHours != null && metrics.meanCandidateReviewAgeHours > 168)
    alerts.push("candidate_review_age_high");
  if (metrics.avgLinkConfidence != null && metrics.avgLinkConfidence < 0.9) alerts.push("match_confidence_low");
  return alerts;
}
