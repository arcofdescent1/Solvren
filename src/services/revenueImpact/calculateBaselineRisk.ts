import type { BaselineRisk, BaselineSignal, RevenueImpactInput, RevenueRiskLevel } from "./revenueImpactTypes";

const CRITICAL_SYSTEMS = ["stripe", "chargebee", "netsuite", "hubspot"];

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function pushSignal(signals: BaselineSignal[], code: string, points: number, detail?: string) {
  signals.push({ code, points, detail });
}

function riskLevelFromScore(score: number): RevenueRiskLevel {
  if (score <= 24) return "LOW";
  if (score <= 49) return "MEDIUM";
  if (score <= 74) return "HIGH";
  return "CRITICAL";
}

export function calculateBaselineRisk(input: RevenueImpactInput): BaselineRisk {
  const signals: BaselineSignal[] = [];
  let score = 10;
  pushSignal(signals, "BASELINE_START", 10);

  const systems = input.change.systems.map(normalize);
  const criticalTouched = CRITICAL_SYSTEMS.filter((s) => systems.some((t) => t.includes(s)));
  for (const sys of criticalTouched.slice(0, 2)) {
    score += 15;
    pushSignal(signals, `CRITICAL_SYSTEM_${sys.toUpperCase()}`, 15);
  }

  if (criticalTouched.length >= 2) {
    score += 10;
    pushSignal(signals, "MULTIPLE_CRITICAL_SYSTEMS", 10);
  }

  const domain = normalize(input.change.domain ?? "");
  if (domain === "finance") {
    score += 10;
    pushSignal(signals, "DOMAIN_FINANCE", 10);
  }
  if (domain === "security" && systems.some((s) => s.includes("auth") || s.includes("payment"))) {
    score += 10;
    pushSignal(signals, "DOMAIN_SECURITY_PAYMENT_AUTH", 10);
  }

  const changeType = normalize(input.change.changeType ?? "");
  if (changeType.includes("pricing")) {
    score += 15;
    pushSignal(signals, "CHANGE_TYPE_PRICING", 15);
  }
  if (changeType.includes("billing")) {
    score += 20;
    pushSignal(signals, "CHANGE_TYPE_BILLING_LOGIC", 20);
  }
  if (changeType.includes("revenue recognition") || changeType.includes("revrec")) {
    score += 20;
    pushSignal(signals, "CHANGE_TYPE_REVENUE_RECOGNITION", 20);
  }
  if (changeType.includes("lead routing")) {
    score += 10;
    pushSignal(signals, "CHANGE_TYPE_LEAD_ROUTING", 10);
  }

  const rollout = normalize(input.change.rolloutMethod ?? "");
  if (rollout === "immediate") {
    score += 10;
    pushSignal(signals, "IMMEDIATE_ROLLOUT", 10);
  } else if (rollout === "gradual") {
    score += 3;
    pushSignal(signals, "GRADUAL_ROLLOUT", 3);
  }

  if (input.change.backfillRequired) {
    score += 10;
    pushSignal(signals, "BACKFILL_REQUIRED", 10);
  }

  if (!input.change.rollbackPlan || input.change.rollbackPlan.trim().length < 12) {
    score += 8;
    pushSignal(signals, "NO_ROLLBACK_PLAN", 8);
  } else {
    score -= 4;
    pushSignal(signals, "ROLLBACK_PLAN_PRESENT", -4);
  }

  if (!input.change.monitoringPlan || input.change.monitoringPlan.trim().length < 12) {
    score += 6;
    pushSignal(signals, "NO_MONITORING_PLAN", 6);
  }

  if (input.change.revenueExposureEstimate == null) {
    score += 8;
    pushSignal(signals, "NO_REVENUE_ESTIMATE", 8);
  }

  const missingEvidence = input.change.evidenceItems.filter(
    (e) => e.status === "REQUIRED" || e.status === "MISSING"
  ).length;
  if (missingEvidence >= 2) {
    score += 10;
    pushSignal(signals, "MISSING_REQUIRED_EVIDENCE", 10, `missing=${missingEvidence}`);
  }

  const similarIncidentCount = input.historical.incidentCount;
  if (similarIncidentCount > 0) {
    const points = Math.min(20, 5 + Math.floor(input.historical.incidentRate * 30));
    score += points;
    pushSignal(signals, "PRIOR_SIMILAR_INCIDENTS", points, `count=${similarIncidentCount}`);
  }

  if (rollout === "gradual" && input.change.monitoringPlan && input.change.monitoringPlan.length > 10) {
    score -= 5;
    pushSignal(signals, "PHASED_WITH_MONITORING", -5);
  }

  if (input.historical.similarChangeCount >= 10 && input.historical.incidentRate === 0) {
    score -= 3;
    pushSignal(signals, "SUCCESSFUL_HISTORY_NO_INCIDENTS", -3);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    baselineRiskScore: score,
    baselineRiskLevel: riskLevelFromScore(score),
    signals,
  };
}
