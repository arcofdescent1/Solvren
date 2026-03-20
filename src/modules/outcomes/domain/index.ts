/**
 * Phase 7 — Outcome domain.
 */

export type OutcomeType = "recovered_revenue" | "avoided_loss" | "operational_savings";
export type VerificationType = "direct" | "inferred" | "probabilistic";

export type OutcomeRow = {
  id: string;
  org_id: string;
  issue_id: string;
  action_id: string | null;
  outcome_type: OutcomeType;
  amount: number;
  currency: string;
  verification_type: VerificationType;
  confidence_score: number;
  evidence_json: Record<string, unknown>;
  created_at: string;
};

export type IssueOutcomeSummaryRow = {
  issue_id: string;
  org_id: string;
  total_recovered: number;
  total_avoided: number;
  total_cost_savings: number;
  outcome_count: number;
  last_updated: string;
};
