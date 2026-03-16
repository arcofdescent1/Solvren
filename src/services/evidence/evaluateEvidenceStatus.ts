/**
 * Evaluate evidence status for a change.
 * Used by approval blocking and UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceItemRow = {
  id: string;
  kind: string;
  label: string;
  severity: string;
  status: string;
  note: string | null;
  url: string | null;
  provided_at: string | null;
  provided_by: string | null;
};

export type EvidenceStatusResult = {
  items: EvidenceItemRow[];
  missingRequired: string[];
  missingRecommended: string[];
  approvalBlocked: boolean;
  missingRequiredKinds: string[];
};

/**
 * Load evidence items and evaluate status.
 * approvalBlocked = any required item has status not in (PROVIDED, WAIVED).
 */
export async function evaluateEvidenceStatus(
  supabase: SupabaseClient,
  changeId: string
): Promise<EvidenceStatusResult> {
  const { data: items, error } = await supabase
    .from("change_evidence_items")
    .select("id, kind, label, severity, status, note, url, provided_at, provided_by")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (items ?? []) as EvidenceItemRow[];
  const requiredItems = rows.filter((r) => r.severity === "REQUIRED");
  const recommendedItems = rows.filter((r) => r.severity === "RECOMMENDED");

  const satisfied = (r: EvidenceItemRow) =>
    r.status === "PROVIDED" || r.status === "WAIVED";

  const missingRequired = requiredItems
    .filter((r) => !satisfied(r))
    .map((r) => r.label);
  const missingRequiredKinds = requiredItems
    .filter((r) => !satisfied(r))
    .map((r) => r.kind);
  const missingRecommended = recommendedItems
    .filter((r) => !satisfied(r))
    .map((r) => r.label);

  const approvalBlocked = missingRequired.length > 0;

  return {
    items: rows,
    missingRequired,
    missingRecommended,
    approvalBlocked,
    missingRequiredKinds,
  };
}
