/**
 * Phase 5 — Issue impact summary (§8.4).
 */
export type IssueImpactSummaryRow = {
  issue_id: string;
  org_id: string;
  latest_assessment_id: string;
  current_direct_realized_loss_amount: number | null;
  current_revenue_at_risk_amount: number | null;
  current_avoided_loss_amount: number | null;
  current_recovered_value_amount: number | null;
  current_operational_cost_amount: number | null;
  current_confidence_score: number;
  current_impact_score: number;
  currency_code: string;
  last_calculated_at: string;
  last_model_key: string;
  last_model_version: string;
};
