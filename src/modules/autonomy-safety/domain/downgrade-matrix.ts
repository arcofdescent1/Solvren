/**
 * Phase 9 — Downgrade matrix (§9.1).
 */
import { ExecutionMode } from "./execution-mode";
import { AutonomyConfidenceBand } from "./autonomy-confidence-band";

const MATRIX: Record<ExecutionMode, Record<AutonomyConfidenceBand, ExecutionMode>> = {
  [ExecutionMode.DRY_RUN]: {
    [AutonomyConfidenceBand.LOW]: ExecutionMode.DRY_RUN,
    [AutonomyConfidenceBand.MEDIUM]: ExecutionMode.DRY_RUN,
    [AutonomyConfidenceBand.HIGH]: ExecutionMode.DRY_RUN,
  },
  [ExecutionMode.SUGGEST_ONLY]: {
    [AutonomyConfidenceBand.LOW]: ExecutionMode.SUGGEST_ONLY,
    [AutonomyConfidenceBand.MEDIUM]: ExecutionMode.SUGGEST_ONLY,
    [AutonomyConfidenceBand.HIGH]: ExecutionMode.SUGGEST_ONLY,
  },
  [ExecutionMode.APPROVAL_REQUIRED]: {
    [AutonomyConfidenceBand.LOW]: ExecutionMode.APPROVAL_REQUIRED,
    [AutonomyConfidenceBand.MEDIUM]: ExecutionMode.APPROVAL_REQUIRED,
    [AutonomyConfidenceBand.HIGH]: ExecutionMode.APPROVAL_REQUIRED,
  },
  [ExecutionMode.BOUNDED_AUTO]: {
    [AutonomyConfidenceBand.LOW]: ExecutionMode.APPROVAL_REQUIRED,
    [AutonomyConfidenceBand.MEDIUM]: ExecutionMode.BOUNDED_AUTO,
    [AutonomyConfidenceBand.HIGH]: ExecutionMode.BOUNDED_AUTO,
  },
  [ExecutionMode.FULL_AUTO]: {
    [AutonomyConfidenceBand.LOW]: ExecutionMode.APPROVAL_REQUIRED,
    [AutonomyConfidenceBand.MEDIUM]: ExecutionMode.BOUNDED_AUTO,
    [AutonomyConfidenceBand.HIGH]: ExecutionMode.FULL_AUTO,
  },
};

export function applyDowngradeMatrix(
  requestedMode: ExecutionMode,
  confidenceBand: AutonomyConfidenceBand
): ExecutionMode {
  return MATRIX[requestedMode]?.[confidenceBand] ?? requestedMode;
}
