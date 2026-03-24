/**
 * Phase 4 — Connector validation for partner/submitted connectors.
 */
import { ConnectorManifestSchema } from "./connectorManifestSchema";

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

export function validateManifest(manifest: unknown): ValidationResult {
  const parsed = ConnectorManifestSchema.safeParse(manifest);
  if (parsed.success) return { valid: true };
  const zodError = parsed.error as { issues?: Array<{ path: (string | number)[]; message: string }> };
  const errors = (zodError?.issues ?? []).map((e) => `${e.path.join(".")}: ${e.message}`);
  return { valid: false, errors };
}

export function validateRuntimeContract(runtime: unknown): ValidationResult {
  const required = [
    "connect",
    "handleCallback",
    "disconnect",
    "refreshAuth",
    "testConnection",
    "getHealth",
    "fetchSchema",
    "runBackfill",
    "runIncrementalSync",
    "receiveWebhook",
    "reconcileWebhooks",
    "executeAction",
  ];
  const errors: string[] = [];
  if (typeof runtime !== "object" || runtime === null) {
    return { valid: false, errors: ["Runtime must be an object"] };
  }
  const r = runtime as Record<string, unknown>;
  for (const method of required) {
    if (typeof r[method] !== "function") {
      errors.push(`Runtime must implement ${method}()`);
    }
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
