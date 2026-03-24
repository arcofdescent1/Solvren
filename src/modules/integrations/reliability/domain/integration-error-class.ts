/**
 * Phase 4 — Integration error classification (§12).
 */
export enum IntegrationErrorClass {
  TRANSIENT_NETWORK = "TRANSIENT_NETWORK",
  RATE_LIMIT = "RATE_LIMIT",
  AUTH = "AUTH",
  PERMISSION = "PERMISSION",
  VALIDATION = "VALIDATION",
  NOT_FOUND = "NOT_FOUND",
  PROVIDER_5XX = "PROVIDER_5XX",
  CONFLICT = "CONFLICT",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
  /** Phase 3 */
  FILE_PARSE_ERROR = "FILE_PARSE_ERROR",
  ROW_VALIDATION_ERROR = "ROW_VALIDATION_ERROR",
  DB_CONNECTIVITY_ERROR = "DB_CONNECTIVITY_ERROR",
  WAREHOUSE_QUERY_ERROR = "WAREHOUSE_QUERY_ERROR",
  CURSOR_CORRUPTION = "CURSOR_CORRUPTION",
  REPLAY_CONFLICT = "REPLAY_CONFLICT",
  /** Phase 4 inbound */
  SIGNATURE_INVALID = "SIGNATURE_INVALID",
  ACCOUNT_RESOLUTION_FAILED = "ACCOUNT_RESOLUTION_FAILED",
  RAW_EVENT_EMIT_FAILED = "RAW_EVENT_EMIT_FAILED",
}

const RETRYABLE: IntegrationErrorClass[] = [
  IntegrationErrorClass.TRANSIENT_NETWORK,
  IntegrationErrorClass.RATE_LIMIT,
  IntegrationErrorClass.TIMEOUT,
  IntegrationErrorClass.PROVIDER_5XX,
];

const NON_RETRYABLE: IntegrationErrorClass[] = [
  IntegrationErrorClass.AUTH,
  IntegrationErrorClass.PERMISSION,
  IntegrationErrorClass.VALIDATION,
  IntegrationErrorClass.NOT_FOUND,
  IntegrationErrorClass.FILE_PARSE_ERROR,
  IntegrationErrorClass.ROW_VALIDATION_ERROR,
  IntegrationErrorClass.CURSOR_CORRUPTION,
  IntegrationErrorClass.REPLAY_CONFLICT,
];

export function isRetryableErrorClass(cls: IntegrationErrorClass): boolean {
  if (RETRYABLE.includes(cls)) return true;
  if (NON_RETRYABLE.includes(cls)) return false;
  if (cls === IntegrationErrorClass.CONFLICT) return false; // conditional per spec
  if (cls === IntegrationErrorClass.UNKNOWN) return false; // max 1 safe retry
  return false;
}
