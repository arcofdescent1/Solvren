/**
 * Phase A2 — Evidence Completeness Scoring
 * Blocks change if evidence_score < threshold.
 * Uses change_evidence_items: REQUIRED severity items must be PROVIDED or WAIVED.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceScore = {
  score: number;
  completed: number;
  required: number;
  threshold: number;
  blocked: boolean;
};

const DEFAULT_THRESHOLD = 1;

export async function computeEvidenceScore(
  client: SupabaseClient,
  changeEventId: string,
  requiredKinds?: string[],
  threshold?: number
): Promise<EvidenceScore> {
  const thresh = threshold ?? DEFAULT_THRESHOLD;

  const { data: items } = await client
    .from("change_evidence_items")
    .select("kind, status, severity")
    .eq("change_event_id", changeEventId);

  const rows = (items ?? []) as Array<{ kind: string; status: string; severity?: string }>;
  const requiredItems = requiredKinds
    ? rows.filter((i) => requiredKinds.includes(i.kind))
    : rows.filter((i) => (i.severity ?? "REQUIRED") === "REQUIRED");

  const required = requiredItems.length;
  const completed = requiredItems.filter(
    (i) => i.status === "PROVIDED" || i.status === "WAIVED"
  ).length;
  const score = required > 0 ? completed / required : 1;
  const blocked = score < thresh;

  return {
    score,
    completed,
    required,
    threshold: thresh,
    blocked,
  };
}
