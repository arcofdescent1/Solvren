/**
 * Phase 3 — CSV connector manifest.
 */
import type { ConnectorManifest } from "../../contracts";

export function getCsvManifest(): ConnectorManifest {
  return {
    provider: "csv",
    displayName: "CSV Import",
    category: "file_import",
    description: "Import data from CSV files for customer exports, recurring uploads, and historical backfill.",
    authType: "custom",
    supportedSyncModes: ["manual"],
    capabilities: ["read_objects", "schema_discovery", "backfill"],
    supportedObjectTypes: ["generic", "customers", "transactions", "subscriptions"],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["CSV file with header row"],
    docsUrl: "",
    iconAssetKey: "csv",
    healthCheckStrategy: "api_probe",
    minimumPlan: "starter",
    isTierOne: false,
  };
}
