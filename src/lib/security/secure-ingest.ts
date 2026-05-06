/**
 * Phase 2 — Mandatory ingestion gate: classify → redact → normalize.
 */
import type { FieldSchema } from "./field-schema-registry";
import { redactPayload, type PayloadAuditMeta } from "./redaction-engine";

export type SecureIngestInput = {
  source: string;
  payload: unknown;
  schema: FieldSchema;
  orgId: string;
  normalize: (redacted: Record<string, unknown>) => Record<string, unknown>;
};

export type SecureIngestResult = {
  /** Post-redaction tree (typed, structural). */
  redacted: Record<string, unknown>;
  /** Minimized / adapter output for sanitized_payload column. */
  normalized: Record<string, unknown>;
  audit: PayloadAuditMeta;
};

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...(payload as Record<string, unknown>) };
  }
  return { _scalar: payload as unknown };
}

/**
 * Runs redaction then integration-specific normalization (financial banding, signal shaping).
 */
export function secureIngest(input: SecureIngestInput): SecureIngestResult {
  const { payload, schema, orgId, normalize } = input;
  const wrapped = asRecord(payload);
  const { sanitized, audit } = redactPayload(wrapped, schema, orgId);
  const redacted =
    sanitized !== null && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : { _value: sanitized as unknown };

  const normalized = normalize(redacted);
  return { redacted, normalized, audit };
}
