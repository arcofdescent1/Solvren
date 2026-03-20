/**
 * Phase 4 — Idempotency key derivation (§10.4, §11.2).
 */
import { createHash } from "crypto";

export type InboundEventForIdempotency = {
  provider: string;
  external_event_id?: string | null;
  external_object_type?: string | null;
  external_object_id?: string | null;
  event_type: string;
  event_time?: string | null;
  payload_hash?: string;
  source_channel: string;
};

/** Precedence: provider durable event id > object+type+time > payload_hash+provider+channel */
export function deriveInboundIdempotencyKey(event: InboundEventForIdempotency): string {
  if (event.external_event_id) {
    return `${event.provider}:${event.external_event_id}`;
  }
  if (event.external_object_id && event.event_type) {
    const timeBucket = event.event_time
      ? new Date(event.event_time).toISOString().slice(0, 13) // hour bucket
      : "none";
    return `${event.provider}:${event.external_object_type ?? "obj"}:${event.external_object_id}:${event.event_type}:${timeBucket}`;
  }
  const hash = event.payload_hash ?? hashPayload(event);
  return `${event.provider}:${event.source_channel}:${hash}`;
}

function hashPayload(event: InboundEventForIdempotency): string {
  const str = JSON.stringify({
    provider: event.provider,
    event_type: event.event_type,
    external_object_id: event.external_object_id,
    event_time: event.event_time,
  });
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

export function hashPayloadContent(payload: unknown): string {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

export type OutboundContextForIdempotency = {
  org_id: string;
  provider: string;
  action_key: string;
  target_ref: Record<string, unknown>;
  request_payload: Record<string, unknown>;
  issue_id?: string | null;
  workflow_run_id?: string | null;
};

/** Deterministic outbound idempotency key */
export function deriveOutboundIdempotencyKey(ctx: OutboundContextForIdempotency): string {
  const normalized = JSON.stringify({
    org: ctx.org_id,
    provider: ctx.provider,
    action: ctx.action_key,
    target: sortKeys(ctx.target_ref),
    request: sortKeys(ctx.request_payload),
    issue: ctx.issue_id ?? null,
    workflow: ctx.workflow_run_id ?? null,
  });
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = obj[k];
  }
  return sorted;
}
