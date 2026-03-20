/**
 * Phase 5 — Ranked action (§17).
 */
import type { FeatureBreakdown } from "./feature-breakdown";

export type RankedAction = {
  actionKey: string;
  provider?: string | null;

  weightedScore: number;
  rank: number;

  approvalRequired: boolean;
  effectiveAutonomyMode:
    | "manual_only"
    | "suggest_only"
    | "approve_then_execute"
    | "auto_execute_low_risk"
    | "auto_execute_policy_bounded"
    | "full_trusted_autonomy";

  featureBreakdown: FeatureBreakdown;

  explanationCodes: string[];
  explanationText: string;
};
