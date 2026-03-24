/**
 * Phase 3 — Snowflake connector manifest.
 */
import type { ConnectorManifest } from "../../contracts";

export function getSnowflakeManifest(): ConnectorManifest {
  return {
    provider: "snowflake",
    displayName: "Snowflake",
    category: "warehouse",
    description: "Sync from Snowflake warehouse for curated analytics pipelines.",
    authType: "service_account",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["read_objects", "schema_discovery", "backfill", "incremental_sync"],
    supportedObjectTypes: [],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["Snowflake account", "Service credentials"],
    docsUrl: "",
    iconAssetKey: "snowflake",
    healthCheckStrategy: "api_probe",
    minimumPlan: "enterprise",
    isTierOne: false,
  };
}
