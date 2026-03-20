/**
 * Phase 9 — Downgrade engine (§9).
 */
import { ExecutionMode } from "../domain";
import { AutonomyConfidenceBand } from "../domain";
import { applyDowngradeMatrix } from "../domain";
import { getEnvironmentCeiling, type AppEnvironment } from "../domain";

export type DowngradeResult = {
  effectiveMode: ExecutionMode;
  reasonCodes: string[];
};

export function applyDowngrades(
  requestedMode: ExecutionMode,
  confidenceBand: AutonomyConfidenceBand,
  confidenceReasonCodes: string[],
  environment: AppEnvironment,
  additionalReasonCodes: string[] = []
): DowngradeResult {
  const reasonCodes: string[] = [...additionalReasonCodes];

  let effective = applyDowngradeMatrix(requestedMode, confidenceBand);
  if (effective !== requestedMode) {
    reasonCodes.push(...confidenceReasonCodes.filter((c) => c.startsWith("low_") || c.startsWith("medium_")));
  }

  const ceiling = getEnvironmentCeiling(environment);
  const ceilingOrder = [ExecutionMode.DRY_RUN, ExecutionMode.SUGGEST_ONLY, ExecutionMode.APPROVAL_REQUIRED, ExecutionMode.BOUNDED_AUTO, ExecutionMode.FULL_AUTO];
  const effectiveIdx = ceilingOrder.indexOf(effective);
  const ceilingIdx = ceilingOrder.indexOf(ceiling);
  if (effectiveIdx > ceilingIdx) {
    effective = ceiling;
    reasonCodes.push("environment_ceiling");
  }

  return {
    effectiveMode: effective,
    reasonCodes: [...new Set(reasonCodes)],
  };
}
