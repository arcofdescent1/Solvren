import type { RawIntegrationEvent, CanonicalRiskEvent, RiskBucket } from "./types";

function bucketFromScore(score: number): RiskBucket {
  if (score <= 30) return "LOW";
  if (score <= 70) return "MODERATE";
  if (score <= 120) return "HIGH";
  return "CRITICAL";
}

function inferRiskType(provider: string, object: string, field?: string): string {
  const f = (field ?? "").toLowerCase();
  const o = (object ?? "").toLowerCase();
  if (f.includes("amount") || f.includes("price") || o.includes("opportunity") || o.includes("deal"))
    return "pricing_change";
  if (f.includes("discount")) return "discount_override";
  if (f.includes("date") || f.includes("close") || f.includes("stage")) return "revenue_timing";
  return "config_change";
}

function baseScore(riskType: string, raw: RawIntegrationEvent): number {
  let score = 30;
  if (riskType === "pricing_change") score += 30;
  if (riskType === "discount_override") score += 40;
  if (riskType === "revenue_timing") score += 25;
  if (riskType === "config_change") score += 40;
  return Math.min(score, 150);
}

export function normalizeEvent(raw: RawIntegrationEvent): Omit<CanonicalRiskEvent, "id"> {
  const riskType = raw.riskType ?? inferRiskType(raw.provider, raw.object ?? "", raw.field);
  const riskScore = baseScore(riskType, raw);
  const riskBucket = bucketFromScore(riskScore);
  const oldVal = raw.old ?? raw.oldValue;
  const newVal = raw.new ?? raw.newValue;
  let impactAmount: number | undefined;
  if (typeof newVal === "number" && typeof oldVal === "number") {
    impactAmount = Math.abs(newVal - oldVal);
  }
  return {
    provider: raw.provider,
    object: raw.object ?? "Unknown",
    objectId: String(raw.objectId ?? "unknown"),
    field: raw.field,
    oldValue: oldVal,
    newValue: newVal,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    actor: raw.actor,
    riskType,
    riskScore,
    riskBucket,
    impactAmount,
    metadata: raw.metadata,
  };
}
