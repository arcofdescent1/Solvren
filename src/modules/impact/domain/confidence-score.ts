/**
 * Phase 5 — Confidence score (§5.8, §11).
 */
export type ConfidenceBand = "high" | "strong" | "moderate" | "low" | "insufficient";

export function getConfidenceBand(score: number): ConfidenceBand {
  if (score >= 90) return "high";
  if (score >= 70) return "strong";
  if (score >= 50) return "moderate";
  if (score >= 25) return "low";
  return "insufficient";
}

export function getConfidenceLabel(band: ConfidenceBand): string {
  switch (band) {
    case "high": return "High confidence";
    case "strong": return "Strong estimate";
    case "moderate": return "Moderate estimate";
    case "low": return "Low confidence";
    case "insufficient": return "Limited estimate";
  }
}
