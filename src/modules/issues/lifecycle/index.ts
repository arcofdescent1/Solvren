/**
 * Phase 1 — Issue lifecycle module.
 */
export * from "./domain";
export {
  getLifecycle,
  transition,
  recordImpact,
  recordActionPlan,
  recordActionExecution,
  recordVerificationResult,
  recordNoActionDecision,
} from "./services/issue-lifecycle.service";
export {
  closeIssue,
  getMissingClosureRequirements,
} from "./services/issue-closure.service";
export { reopenIssue } from "./services/issue-reopen.service";
export { validateTransition, validateClosureInvariant } from "./services/issue-lifecycle-validator.service";
