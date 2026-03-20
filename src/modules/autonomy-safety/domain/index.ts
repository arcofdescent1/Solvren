export { ExecutionMode } from "./execution-mode";
export {
  AutonomyConfidenceBand,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  scoreToBand,
} from "./autonomy-confidence-band";
export { AutomationPauseType } from "./automation-pause-type";
export {
  DOWNGRADE_REASON_CODES,
  type DowngradeReasonCode,
} from "./reason-codes";
export {
  ENVIRONMENT_CEILINGS,
  getEnvironmentCeiling,
  type AppEnvironment,
} from "./environment-ceiling";
export { applyDowngradeMatrix } from "./downgrade-matrix";
