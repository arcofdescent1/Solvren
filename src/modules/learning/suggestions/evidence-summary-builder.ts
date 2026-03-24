/**
 * Phase 6 — Aggregate evidence for suggestion payloads.
 */
export type EvidenceSummary = {
  windowDescription: string;
  sampleSize: number;
  dispositionCounts: Record<string, number>;
  topActionKeys: Array<{ action_key: string | null; count: number }>;
  notes: string[];
};

export function buildEvidenceSummaryFromFacts(
  facts: Array<{ disposition?: string; action_key?: string | null }>,
  windowLabel: string
): EvidenceSummary {
  const dispositionCounts: Record<string, number> = {};
  const actionCounts = new Map<string | null, number>();

  for (const f of facts) {
    const d = f.disposition ?? "UNKNOWN";
    dispositionCounts[d] = (dispositionCounts[d] ?? 0) + 1;
    const ak = f.action_key ?? null;
    actionCounts.set(ak, (actionCounts.get(ak) ?? 0) + 1);
  }

  const topActionKeys = [...actionCounts.entries()]
    .map(([action_key, count]) => ({ action_key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    windowDescription: windowLabel,
    sampleSize: facts.length,
    dispositionCounts,
    topActionKeys,
    notes: [],
  };
}
