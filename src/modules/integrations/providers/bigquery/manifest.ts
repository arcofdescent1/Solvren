/**
 * Phase 3 — BigQuery connector manifest.
 */
import type { ConnectorManifest } from "../../contracts";

export function getBigQueryManifest(): ConnectorManifest {
  return {
    provider: "bigquery",
    displayName: "BigQuery",
    category: "warehouse",
    description: "Sync from BigQuery for centralized enterprise data.",
    authType: "service_account",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["read_objects", "schema_discovery", "backfill", "incremental_sync"],
    supportedObjectTypes: [],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["Google Cloud project", "Service account credentials"],
    docsUrl: "",
    iconAssetKey: "bigquery",
    healthCheckStrategy: "api_probe",
    minimumPlan: "enterprise",
    isTierOne: false,
  };
}
