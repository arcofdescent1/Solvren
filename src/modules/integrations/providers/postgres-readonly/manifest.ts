/**
 * Phase 3 — PostgreSQL read-only connector manifest.
 */
import type { ConnectorManifest } from "../../contracts";

export function getPostgresReadonlyManifest(): ConnectorManifest {
  return {
    provider: "postgres_readonly",
    displayName: "PostgreSQL (Read-Only)",
    category: "database",
    description: "Read from customer PostgreSQL databases for legacy systems and operational data.",
    authType: "basic",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["read_objects", "schema_discovery", "backfill", "incremental_sync"],
    supportedObjectTypes: [],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["PostgreSQL connection details"],
    docsUrl: "",
    iconAssetKey: "postgres",
    healthCheckStrategy: "api_probe",
    minimumPlan: "growth",
    isTierOne: false,
  };
}
