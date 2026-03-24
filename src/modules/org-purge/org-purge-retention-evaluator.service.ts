import { ORG_PURGE_RETENTION_POLICY_LINES } from "./org-purge-retention-policy";
import type { RetentionExceptionCode } from "./types";

export type RetentionEvaluation =
  | { blocked: true; reason: "RETAIN_LEGAL_HOLD"; message: string }
  | {
      blocked: false;
      exceptions: { code: RetentionExceptionCode; note: string }[];
    };

/**
 * Phase 7 — mandatory gate before any destructive purge work.
 */
export function evaluateOrgPurgeRetention(input: { legalHoldActive: boolean }): RetentionEvaluation {
  if (input.legalHoldActive) {
    return {
      blocked: true,
      reason: "RETAIN_LEGAL_HOLD",
      message: "Purge is blocked while legal_hold_active is true.",
    };
  }
  return {
    blocked: false,
    exceptions: [...ORG_PURGE_RETENTION_POLICY_LINES],
  };
}
