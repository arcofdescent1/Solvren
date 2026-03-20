/**
 * Phase 5 — Decision explainer service (§21).
 * Generates explanation codes and human-readable text.
 */
import type { RankedAction } from "../domain/ranked-action";
import type { FeatureBreakdown } from "../domain/feature-breakdown";

export function generateExplanationCodes(
  breakdown: FeatureBreakdown,
  fallbackCodes: string[],
  approvalRequired: boolean,
  usedColdStart: boolean,
  actionDisplayName: string
): string[] {
  const codes: string[] = [...fallbackCodes];

  if (breakdown.impactNorm >= 70) codes.push("value_high");
  if (breakdown.confidenceNorm >= 80) codes.push("confidence_high");
  if (breakdown.confidenceNorm < 50 && !fallbackCodes.includes("missing_data_fallback"))
    codes.push("confidence_low");
  if (breakdown.historicalSuccessNorm >= 70) codes.push("historically_effective");
  if (breakdown.riskPenaltyNorm <= 15) codes.push("low_risk");
  if (breakdown.riskPenaltyNorm >= 60) codes.push("high_risk_penalty");
  if (breakdown.policyPreferenceNorm >= 70) codes.push("policy_preferred");
  if (approvalRequired) codes.push("requires_approval");
  if (breakdown.cooldownPenaltyNorm > 0) codes.push("cooldown_penalty");
  if (usedColdStart) codes.push("cold_start_default");

  return [...new Set(codes)];
}

export function generateExplanationText(
  actionKey: string,
  actionDisplayName: string,
  codes: string[],
  rank: number
): string {
  const parts: string[] = [];
  if (codes.includes("value_high")) parts.push("high impact");
  if (codes.includes("historically_effective")) parts.push("strong historical success");
  if (codes.includes("low_risk")) parts.push("low risk");
  if (codes.includes("confidence_high")) parts.push("high confidence");
  if (codes.includes("cold_start_default")) parts.push("selected as safe default in cold-start mode");
  if (codes.includes("requires_approval")) parts.push("approval required under current policy");
  if (codes.includes("high_risk_penalty")) parts.push("higher risk penalty applied");

  const display = actionDisplayName || actionKey;
  const reason = parts.length > 0 ? parts.join(", ") : "scored based on available features";
  return `${display} ranked #${rank} because it has ${reason}.`;
}

export function buildExplanationForRankedAction(
  action: Omit<RankedAction, "explanationCodes" | "explanationText">,
  fallbackCodes: string[],
  usedColdStart: boolean,
  actionDisplayName: string
): Pick<RankedAction, "explanationCodes" | "explanationText"> {
  const codes = generateExplanationCodes(
    action.featureBreakdown,
    fallbackCodes,
    action.approvalRequired,
    usedColdStart,
    actionDisplayName
  );
  const text = generateExplanationText(
    action.actionKey,
    actionDisplayName,
    codes,
    action.rank
  );
  return { explanationCodes: codes, explanationText: text };
}
