/**
 * Phase 6 — Distribution drift signals (report-only; does not mutate policy).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDecisionFactsForOrg } from "../data/governance-decision-facts.service";

export type DriftSnapshot = {
  windowStart: string;
  windowEnd: string;
  dispositionShares: Record<string, number>;
  sampleSize: number;
};

export async function computeDispositionDriftSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  windowDays: number
): Promise<{ data: DriftSnapshot | null; error: Error | null }> {
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();
  const { data: facts, error } = await listDecisionFactsForOrg(supabase, orgId, { limit: 5000, since });
  if (error) return { data: null, error };

  const counts: Record<string, number> = {};
  for (const f of facts) {
    const d = f.disposition ?? "UNKNOWN";
    counts[d] = (counts[d] ?? 0) + 1;
  }
  const n = facts.length || 1;
  const dispositionShares: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    dispositionShares[k] = v / n;
  }

  return {
    data: {
      windowStart: since,
      windowEnd: new Date().toISOString(),
      dispositionShares,
      sampleSize: facts.length,
    },
    error: null,
  };
}
