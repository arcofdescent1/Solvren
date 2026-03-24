/**
 * Phase 4 — Inbound event status machine (§5).
 */
export const INBOUND_STATUSES = [
  "RECEIVED",
  "VALIDATED",
  "QUEUED",
  "PROCESSED",
  "FAILED",
  "DEAD_LETTERED",
] as const;

export type InboundIngestStatus = (typeof INBOUND_STATUSES)[number];

const VALID_TRANSITIONS: Record<InboundIngestStatus, InboundIngestStatus[]> = {
  RECEIVED: ["VALIDATED"],
  VALIDATED: ["QUEUED"],
  QUEUED: ["PROCESSED", "FAILED"],
  PROCESSED: ["QUEUED"], // replay with admin override
  FAILED: ["QUEUED", "DEAD_LETTERED"],
  DEAD_LETTERED: ["QUEUED"],
};

export function assertValidInboundTransition(
  from: InboundIngestStatus,
  to: InboundIngestStatus
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new Error(`Invalid inbound transition: ${from} -> ${to}`);
  }
}

export function isValidInboundTransition(
  from: InboundIngestStatus,
  to: InboundIngestStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
