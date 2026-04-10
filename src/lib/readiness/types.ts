export type { PredictionType } from "./predictionTypes";

export type ReadinessLevel = "READY" | "WATCH" | "AT_RISK" | "NOT_READY";

export type ReadinessScopeType = "CHANGE" | "RELEASE" | "PORTFOLIO";

/** predicted_risk_events.explanation_json (schemaVersion 1) */
export type PredictionExplanationV1 = {
  schemaVersion: 1;
  headline: string;
  bullets: string[];
  signals: Array<{ type: string; weight: number }>;
  historicalComparison: {
    sampleSize: number;
    matchRate: number;
    summary: string;
  };
  confidence: number;
};

export type ReadinessWeights = {
  evidence: number;
  approvals: number;
  risk: number;
  rollback: number;
  dependencies: number;
  historical: number;
};

export const DEFAULT_READINESS_WEIGHTS: ReadinessWeights = {
  evidence: 25,
  approvals: 20,
  risk: 20,
  rollback: 15,
  dependencies: 10,
  historical: 10,
};

export function scoreToLevel(score: number): ReadinessLevel {
  if (score >= 90) return "READY";
  if (score >= 70) return "WATCH";
  if (score >= 50) return "AT_RISK";
  return "NOT_READY";
}

export function levelRank(l: ReadinessLevel): number {
  switch (l) {
    case "READY":
      return 3;
    case "WATCH":
      return 2;
    case "AT_RISK":
      return 1;
    default:
      return 0;
  }
}

export function worsenedByBands(
  prev: ReadinessLevel | null,
  next: ReadinessLevel
): boolean {
  if (!prev) return false;
  return levelRank(next) < levelRank(prev);
}
