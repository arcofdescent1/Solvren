/**
 * Phase 1 — NetSuite connector manifest (§14.6).
 * Tier 2: ERP, service account / custom auth, manifest + health.
 */
import type { ConnectorManifest } from "../../contracts";

export function getNetSuiteManifest(): ConnectorManifest {
  return {
    provider: "netsuite",
    displayName: "NetSuite",
    category: "erp",
    description: "Connect NetSuite for order and revenue data context.",
    authType: "service_account",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["read_objects", "health_checks", "schema_discovery"],
    supportedObjectTypes: ["customers", "transactions", "subsidiaries"],
    supportedInboundEvents: [],
    supportedOutboundActions: [],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["NetSuite account", "Integration credentials"],
    docsUrl: "https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/",
    iconAssetKey: "netsuite",
    healthCheckStrategy: "api_probe",
    minimumPlan: "enterprise",
    isTierOne: false,
  };
}
