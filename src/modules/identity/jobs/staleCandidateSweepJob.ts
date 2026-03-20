/**
 * Phase 2 — Expire/archive stale match candidates (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listMatchCandidates } from "../repositories/matchCandidateRepository";

const DEFAULT_STALE_DAYS = 30;

export type StaleCandidateSweepInput = {
  orgId: string;
  staleDays?: number;
  limit?: number;
};

export type StaleCandidateSweepResult = {
  expired: number;
  updated: number;
};

/** Mark old pending candidates as rejected (stale). */
export async function runStaleCandidateSweepJob(
  supabase: SupabaseClient,
  input: StaleCandidateSweepInput
): Promise<StaleCandidateSweepResult> {
  const staleDays = input.staleDays ?? DEFAULT_STALE_DAYS;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  const cutoffIso = cutoff.toISOString();

  const { data: pending } = await listMatchCandidates(supabase, {
    orgId: input.orgId,
    reviewStatus: "pending",
    limit: input.limit ?? 200,
  });
  let updated = 0;
  for (const c of pending) {
    if (c.created_at < cutoffIso) {
      const { error } = await supabase
        .from("entity_match_candidates")
        .update({
          review_status: "rejected",
          review_notes: `Auto-expired: stale after ${staleDays} days`,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (!error) updated++;
    }
  }
  return { expired: pending.filter((c) => c.created_at < cutoffIso).length, updated };
}
