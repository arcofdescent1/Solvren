/**
 * Phase 1 — Integration telemetry (§18). Structured logs and metrics placeholders.
 */
import type { IntegrationProvider } from "../contracts/types";

export type IntegrationMetricEvent = {
  orgId: string;
  provider: IntegrationProvider;
  integrationAccountId?: string;
  operation: string;
  status: "success" | "failure";
  durationMs?: number;
  errorCode?: string;
  requestId?: string;
};

/** Emit a metric event (log for now; can send to metrics backend later). */
export function emitIntegrationMetric(event: IntegrationMetricEvent): void {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.info("[integration_metric]", JSON.stringify(payload));
  }
}

/** Log integration operation for audit (§18.3). */
export function logIntegrationOperation(
  orgId: string,
  provider: string,
  operation: string,
  result: "ok" | "error",
  details?: { integrationAccountId?: string; errorCode?: string; requestId?: string }
): void {
  const payload = {
    org_id: orgId,
    provider,
    operation,
    result,
    ...details,
    timestamp: new Date().toISOString(),
  };
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.info("[integration_audit]", JSON.stringify(payload));
  }
}
