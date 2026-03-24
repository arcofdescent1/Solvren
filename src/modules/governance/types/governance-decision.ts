/**
 * Phase 5 — Normalized governance outcome for callers, UI, and audit.
 */
import type { AutonomyMode } from "@/modules/policy/domain";
import type { GovernanceAutonomyMode } from "./governance-context";

export type GovernanceDisposition =
  | "ALLOW"
  | "BLOCK"
  | "REQUIRE_APPROVAL"
  | "LIMIT_AUTONOMY";

export type GovernanceDecision = {
  disposition: GovernanceDisposition;
  reasonCodes: string[];
  matchedPolicyIds: string[];
  matchedRuleIds: string[];
  approval?: {
    required: boolean;
    approverRoles?: string[];
    quorum?: number;
    policySource?: string;
  };
  autonomy?: {
    maxMode?: GovernanceAutonomyMode;
    /** Canonical evaluator mode after caps (policy engine). */
    effectivePolicyMode?: AutonomyMode;
  };
  explainability: {
    headline: string;
    details: string[];
  };
  traceId: string;
};
