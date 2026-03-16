/**
 * Phase 7 + Phase C2 — Risk Scoring Engine
 * risk_score = change_type_weight + impact_amount_weight + approval_status_weight + system_weight
 */
import type { CanonicalRiskEvent } from "./types";

const CHANGE_TYPE_WEIGHTS: Record<string, number> = {
  pricing_change: 40,
  discount_override: 50,
  config_change: 25,
  revenue_timing: 25,
  revenue_commitment: 30,
  unapproved_change: 60,
};

const SYSTEM_WEIGHTS: Record<string, number> = {
  salesforce: 25,
  netsuite: 30,
  hubspot: 20,
  jira: 15,
  github: 10,
};

export function evaluateRisk(event: Omit<CanonicalRiskEvent, "riskScore" | "riskBucket">): { riskScore: number; riskBucket: CanonicalRiskEvent["riskBucket"] } {
  let score = 30;

  const changeTypeWeight = CHANGE_TYPE_WEIGHTS[event.riskType] ?? 30;
  score += changeTypeWeight;

  const impactAmount = Number(event.impactAmount ?? 0);
  const impactWeight = impactAmount >= 100000 ? 30 : impactAmount >= 50000 ? 20 : impactAmount >= 10000 ? 10 : 0;
  score += impactWeight;

  const approvalWeight = event.approvedAt ? 0 : 60;
  score += approvalWeight;

  const provider = event.provider?.toLowerCase();
  const systemWeight = provider ? (SYSTEM_WEIGHTS[provider] ?? 15) : 15;
  score += systemWeight;

  if (score <= 40) return { riskScore: score, riskBucket: "LOW" };
  if (score <= 90) return { riskScore: score, riskBucket: "MODERATE" };
  if (score <= 150) return { riskScore: score, riskBucket: "HIGH" };
  return { riskScore: score, riskBucket: "CRITICAL" };
}
