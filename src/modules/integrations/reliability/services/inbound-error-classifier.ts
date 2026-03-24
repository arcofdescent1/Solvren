/**
 * Phase 4 — Inbound error classification (§7.2).
 */
export const INBOUND_ERROR_CODES = [
  "SIGNATURE_INVALID",
  "ACCOUNT_RESOLUTION_FAILED",
  "NORMALIZATION_FAILED",
  "RAW_EVENT_EMIT_FAILED",
  "TRANSIENT_PROVIDER_PAYLOAD_ERROR",
  "NON_RETRYABLE_PROVIDER_PAYLOAD_ERROR",
] as const;

export type InboundErrorCode = (typeof INBOUND_ERROR_CODES)[number];

const NON_RETRYABLE: InboundErrorCode[] = [
  "SIGNATURE_INVALID",
  "ACCOUNT_RESOLUTION_FAILED",
  "NORMALIZATION_FAILED",
  "NON_RETRYABLE_PROVIDER_PAYLOAD_ERROR",
];

export function classifyInboundError(errorMessage?: string | null): InboundErrorCode {
  const msg = (errorMessage ?? "").toLowerCase();
  if (msg.includes("signature") || msg.includes("unauthorized")) return "SIGNATURE_INVALID";
  if (msg.includes("account") && (msg.includes("not found") || msg.includes("resolution")))
    return "ACCOUNT_RESOLUTION_FAILED";
  if (msg.includes("normalization") || msg.includes("invalid payload")) return "NORMALIZATION_FAILED";
  if (msg.includes("duplicate") || msg.includes("conflict") || msg.includes("23505"))
    return "NON_RETRYABLE_PROVIDER_PAYLOAD_ERROR";
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("network"))
    return "TRANSIENT_PROVIDER_PAYLOAD_ERROR";
  return "RAW_EVENT_EMIT_FAILED";
}

export function isInboundErrorRetryable(
  code: InboundErrorCode,
  _errorMessage?: string | null
): boolean {
  return !NON_RETRYABLE.includes(code);
}
