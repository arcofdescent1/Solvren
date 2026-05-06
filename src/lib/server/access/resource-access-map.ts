/**
 * Phase 4 — explicit field allowlists per resource + masking tier. No dynamic guessing.
 */
import type { CustomerResourceType } from "./access-types";
import type { DataMaskingTier } from "./access-types";

export const RESOURCE_ACCESS_MAP: Record<
  CustomerResourceType,
  Record<DataMaskingTier, readonly string[] | "*">
> = {
  organization: {
    metadata: ["id", "name", "slug", "created_at", "plan", "billing_status", "integration_status", "last_active_at"],
    masked: ["id", "name", "slug", "created_at", "plan", "billing_status", "integration_status", "last_active_at", "region"],
    sensitive: "*",
  },
  integration: {
    metadata: ["id", "provider", "status", "created_at"],
    masked: ["id", "provider", "status", "created_at", "last_sync_at", "last_error_code"],
    sensitive: "*",
  },
  issue: {
    metadata: ["id", "status", "created_at"],
    masked: ["id", "status", "created_at", "priority", "domain_key"],
    sensitive: "*",
  },
  event: {
    metadata: ["id", "created_at", "type"],
    masked: ["id", "created_at", "type", "severity"],
    sensitive: "*",
  },
  insight: {
    metadata: ["id", "created_at", "kind"],
    masked: ["id", "created_at", "kind", "confidence_band"],
    sensitive: "*",
  },
  audit_log: {
    metadata: ["id", "created_at", "action"],
    masked: ["id", "created_at", "action", "target_type"],
    sensitive: "*",
  },
  executive_dashboard: {
    metadata: ["id", "updated_at"],
    masked: ["id", "updated_at", "summary_mode"],
    sensitive: "*",
  },
  report: {
    metadata: ["id", "created_at", "type"],
    masked: ["id", "created_at", "type", "status"],
    sensitive: "*",
  },
};
