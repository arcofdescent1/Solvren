export const RISK_PRIORITY_CATEGORY_KEYS = [
  "revenue_leakage",
  "approval_delays",
  "crm_data_quality",
  "failed_automations",
  "sla_breaches",
  "security_compliance",
  "forecast_accuracy",
  "fulfillment_workflow_errors",
] as const;

export type RiskPriorityCategoryKey = (typeof RISK_PRIORITY_CATEGORY_KEYS)[number];

export const RISK_PRIORITY_LABELS: Record<RiskPriorityCategoryKey, string> = {
  revenue_leakage: "Revenue Leakage",
  approval_delays: "Approval Delays",
  crm_data_quality: "CRM / Data Quality",
  failed_automations: "Failed Automations",
  sla_breaches: "SLA Breaches",
  security_compliance: "Security / Compliance",
  forecast_accuracy: "Forecast Accuracy",
  fulfillment_workflow_errors: "Fulfillment / Workflow Errors",
};

export function isRiskPriorityCategoryKey(v: string): v is RiskPriorityCategoryKey {
  return (RISK_PRIORITY_CATEGORY_KEYS as readonly string[]).includes(v);
}
