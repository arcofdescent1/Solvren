/**
 * Gap 4 — Execution state machine (§8).
 * Valid transitions only. Invalid transitions throw.
 */
export type ExecutionState =
  | "PENDING"
  | "EXECUTING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTERED"
  | "PARTIAL_SUCCESS"
  | "VERIFIED";

const VALID_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  PENDING: ["EXECUTING"],
  EXECUTING: ["SUCCESS", "FAILED", "RETRYING"],
  RETRYING: ["EXECUTING", "FAILED"],
  SUCCESS: ["VERIFIED"],
  PARTIAL_SUCCESS: ["VERIFIED"],
  FAILED: ["PENDING"], // manual retry
  DEAD_LETTERED: ["PENDING"], // manual retry after DLQ
  VERIFIED: [],
};

export function canTransition(from: ExecutionState, to: ExecutionState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertValidTransition(
  from: ExecutionState,
  to: ExecutionState
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid execution transition: ${from} → ${to}`
    );
  }
}
