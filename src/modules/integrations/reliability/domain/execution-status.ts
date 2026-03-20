/**
 * Phase 4 — Execution status for outbound actions.
 */
export type ExecutionStatus =
  | "PENDING"
  | "EXECUTING"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTERED"
  | "VERIFIED";
