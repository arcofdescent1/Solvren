/** Canonical risk domain — single source of truth for multi-domain risk architecture. */
export type RiskDomain =
  | "REVENUE"
  | "DATA"
  | "WORKFLOW"
  | "SECURITY";

export const RISK_DOMAINS: RiskDomain[] = [
  "REVENUE",
  "DATA",
  "WORKFLOW",
  "SECURITY",
];

export function isRiskDomain(s: string): s is RiskDomain {
  return RISK_DOMAINS.includes(s as RiskDomain);
}
