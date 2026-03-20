/**
 * Phase 3 — Idempotency key generation (§10).
 */
export type IdempotencyStrategy =
  | "provider_event_id"
  | "provider_object_time"
  | "provider_object_stage_time"
  | "provider_invoice_failure_time"
  | "internal_object_time";

/**
 * Derive idempotency key from raw event metadata.
 * Priority: 1) provider event id, 2) object id + event type + time, 3) payload hash + time bucket
 */
export function deriveIdempotencyKey(params: {
  provider: string;
  externalEventId?: string | null;
  externalObjectType?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  eventTime?: string | null;
  payloadHash: string;
  strategy?: IdempotencyStrategy;
}): string {
  if (params.externalEventId?.trim()) {
    return `${params.provider}:evt:${params.externalEventId.trim()}`;
  }
  if (params.externalObjectId?.trim() && params.eventType) {
    const timePart = params.eventTime ? new Date(params.eventTime).toISOString().slice(0, 19) : "none";
    return `${params.provider}:obj:${params.externalObjectType ?? "unknown"}:${params.externalObjectId}:${params.eventType}:${timePart}`;
  }
  const bucket = new Date().toISOString().slice(0, 13);
  return `${params.provider}:hash:${params.payloadHash.slice(0, 32)}:${bucket}`;
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return Math.abs(h).toString(16) + str.length.toString(16);
}
