/**
 * Phase 1 — Typed integration errors (§6.4).
 * Connectors raise these; never write arbitrary Error messages.
 */

import type { IntegrationProvider } from "./types";

export const INTEGRATION_ERROR_CODES = {
  UNAUTHORIZED: "integration_unauthorized",
  AUTH_EXPIRED: "integration_auth_expired",
  REFRESH_FAILED: "integration_refresh_failed",
  SCOPE_MISSING: "integration_scope_missing",
  RATE_LIMITED: "integration_rate_limited",
  PROVIDER_ERROR: "integration_provider_error",
  VALIDATION_FAILED: "integration_validation_failed",
  WEBHOOK_SIGNATURE_INVALID: "integration_webhook_signature_invalid",
  NOT_FOUND: "integration_not_found",
  CONFIG_INVALID: "integration_config_invalid",
  CONNECTION_FAILED: "integration_connection_failed",
} as const;

export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[keyof typeof INTEGRATION_ERROR_CODES];

export class IntegrationError extends Error {
  constructor(
    public readonly code: IntegrationErrorCode,
    message: string,
    public readonly provider?: IntegrationProvider,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "IntegrationError";
    Object.setPrototypeOf(this, IntegrationError.prototype);
  }
}

export class IntegrationAuthError extends IntegrationError {
  constructor(
    code: IntegrationErrorCode,
    message: string,
    provider?: IntegrationProvider,
    details?: unknown
  ) {
    super(code, message, provider, details);
    this.name = "IntegrationAuthError";
  }
}

export class IntegrationValidationError extends IntegrationError {
  constructor(message: string, provider?: IntegrationProvider, details?: unknown) {
    super(INTEGRATION_ERROR_CODES.VALIDATION_FAILED, message, provider, details);
    this.name = "IntegrationValidationError";
  }
}
