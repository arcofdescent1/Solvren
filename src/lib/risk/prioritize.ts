/**
 * Gap 7: Risk prioritization for the Revenue Risk Briefing.
 * priority = estimated_impact × confidence_level × recency_factor
 */
export type RiskForPriority = {
  id: string;
  impact_amount: number | null;
  confidence_level: string | null;
  timestamp: string;
  approved_at: string | null;
};

const CONFIDENCE_MULT: Record<string, number> = {
  HIGH: 1.0,
  MEDIUM: 0.7,
  LOW: 0.4,
};

function recencyFactor(timestamp: string): number {
  const ts = new Date(timestamp).getTime();
  const now = Date.now();
  const hours = (now - ts) / (1000 * 60 * 60);
  if (hours <= 24) return 1.0;
  if (hours <= 72) return 0.8;
  return 0.5;
}

export function computePriorityScore(risk: RiskForPriority): number {
  if (risk.approved_at) return 0;
  const impact = Number(risk.impact_amount) || 0;
  const conf = CONFIDENCE_MULT[risk.confidence_level ?? ""] ?? 0.7;
  const rec = recencyFactor(risk.timestamp);
  return impact * conf * rec;
}

/** Returns risks sorted by priority descending (highest first). */
export function sortByPriority<T extends RiskForPriority>(risks: T[]): T[] {
  return [...risks].sort((a, b) => computePriorityScore(b) - computePriorityScore(a));
}
