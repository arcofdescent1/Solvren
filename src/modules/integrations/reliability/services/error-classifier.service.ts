/**
 * Phase 4 — Error classification (§12).
 */
import { IntegrationErrorClass, isRetryableErrorClass } from "../domain/integration-error-class";

export function classifyError(
  httpStatus: number | null,
  errorCode?: string | null,
  errorMessage?: string | null
): IntegrationErrorClass {
  const code = (errorCode ?? "").toUpperCase();
  const msg = (errorMessage ?? "").toLowerCase();

  if (httpStatus === 401 || httpStatus === 403 || code.includes("UNAUTHORIZED") || code.includes("AUTH")) {
    return IntegrationErrorClass.AUTH;
  }
  if (httpStatus === 403 || code.includes("FORBIDDEN") || code.includes("PERMISSION")) {
    return IntegrationErrorClass.PERMISSION;
  }
  if (httpStatus === 404 || code.includes("NOT_FOUND")) {
    return IntegrationErrorClass.NOT_FOUND;
  }
  if (httpStatus === 400 || httpStatus === 422 || code.includes("VALIDATION") || code.includes("INVALID")) {
    return IntegrationErrorClass.VALIDATION;
  }
  if (httpStatus === 409 || code.includes("CONFLICT") || code.includes("DUPLICATE")) {
    return IntegrationErrorClass.CONFLICT;
  }
  if (httpStatus === 429 || code.includes("RATE_LIMIT") || msg.includes("rate limit")) {
    return IntegrationErrorClass.RATE_LIMIT;
  }
  if (httpStatus && httpStatus >= 500) {
    return IntegrationErrorClass.PROVIDER_5XX;
  }
  if (code.includes("TIMEOUT") || code.includes("ETIMEDOUT") || msg.includes("timeout")) {
    return IntegrationErrorClass.TIMEOUT;
  }
  if (code.includes("ECONNRESET") || code.includes("ENOTFOUND") || code.includes("NETWORK")) {
    return IntegrationErrorClass.TRANSIENT_NETWORK;
  }

  return IntegrationErrorClass.UNKNOWN;
}

export function isRetryable(
  httpStatus: number | null,
  errorCode?: string | null,
  errorMessage?: string | null
): boolean {
  const cls = classifyError(httpStatus, errorCode, errorMessage);
  return isRetryableErrorClass(cls);
}
