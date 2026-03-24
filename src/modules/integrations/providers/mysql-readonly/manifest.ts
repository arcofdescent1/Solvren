/**
 * Phase 3 — MySQL read-only connector manifest.
 */
import type { ConnectorManifest } from "../../contracts";

export function getMysqlReadonlyManifest(): ConnectorManifest {
  return {
    provider: "mysql_readonly",
    displayName: "MySQL (Read-Only)",
    category: "database",
    description: "Read from customer MySQL databases for legacy systems and operational data.",
    authType: "basic",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["read_objects", "schema_discovery", "backfill", "incremental_sync"],
    supportedObjectTypes: [],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["MySQL connection details"],
    docsUrl: "",
    iconAssetKey: "mysql",
    healthCheckStrategy: "api_probe",
    minimumPlan: "growth",
    isTierOne: false,
  };
}
