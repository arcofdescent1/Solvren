/**
 * Phase 5 — Candidate action (§9.3).
 */
export type CandidateAction = {
  actionKey: string;
  provider?: string | null;
  category: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresEntityType?: string | null;
};
