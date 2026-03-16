/**
 * Phase A3 — Canonical Risk Categories
 * Maps to governance rules and approval policies.
 */
export const RISK_CATEGORIES = [
  "pricing",
  "billing_logic",
  "contract_terms",
  "revenue_recognition",
  "lead_routing",
  "reporting",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  pricing: "Pricing",
  billing_logic: "Billing Logic",
  contract_terms: "Contract Terms",
  revenue_recognition: "Revenue Recognition",
  lead_routing: "Lead Routing",
  reporting: "Reporting",
};
