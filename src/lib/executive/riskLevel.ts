import type { ExecutiveRiskLevel } from "./types";

/** Map governance / assessment buckets to executive canonical risk. */
export function normalizeRiskLevel(input: string | null | undefined): ExecutiveRiskLevel {
  const u = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (u === "LOW" || u === "L") return "LOW";
  if (u === "MEDIUM" || u === "MED" || u === "MODERATE") return "MEDIUM";
  if (u === "HIGH" || u === "H") return "HIGH";
  if (u === "CRITICAL" || u === "VERY_HIGH" || u === "VERYHIGH" || u === "CATASTROPHIC")
    return "CRITICAL";
  return "MEDIUM";
}
