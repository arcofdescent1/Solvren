/**
 * Canonical Solvren change status values.
 * All status mapping, validation, and config must use this enum.
 * @see Phase 3 — Jira Production Hardening
 */
export const RG_CHANGE_STATUSES = [
  "DRAFT",
  "READY",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "CLOSED",
  "RESOLVED",
] as const;

export type RgChangeStatus = (typeof RG_CHANGE_STATUSES)[number];

export const RG_CHANGE_STATUS_SET = new Set<string>(RG_CHANGE_STATUSES);

export function isValidRgStatus(s: string): s is RgChangeStatus {
  return RG_CHANGE_STATUS_SET.has(String(s).toUpperCase());
}

export function normalizeRgStatus(s: string): RgChangeStatus | null {
  const u = String(s).toUpperCase();
  return RG_CHANGE_STATUS_SET.has(u) ? (u as RgChangeStatus) : null;
}
