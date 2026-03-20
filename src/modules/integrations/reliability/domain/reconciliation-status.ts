/**
 * Phase 4 — Reconciliation status and type.
 */
export type ReconciliationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "VERIFIED_SUCCESS"
  | "VERIFIED_FAILURE";

export enum ReconciliationType {
  REFETCH_ENTITY = "REFETCH_ENTITY",
  WAIT_FOR_WEBHOOK = "WAIT_FOR_WEBHOOK",
  POLL_STATUS = "POLL_STATUS",
  COMPOSITE = "COMPOSITE",
}
