/**
 * Phase 1 — Salesforce connector manifest (§14.2).
 * Tier 1: CRM, OAuth, leads/contacts/accounts/opportunities, tasks.
 */
import type { ConnectorManifest } from "../../contracts";

export function getSalesforceManifest(): ConnectorManifest {
  return {
    provider: "salesforce",
    displayName: "Salesforce",
    category: "crm",
    description: "Protect pipeline continuity and opportunity progression.",
    authType: "oauth2",
    supportedSyncModes: ["polling", "hybrid"],
    capabilities: [
      "read_objects",
      "execute_actions",
      "health_checks",
      "schema_discovery",
      "backfill",
      "incremental_sync",
    ],
    supportedObjectTypes: ["leads", "contacts", "accounts", "opportunities", "users", "tasks"],
    supportedInboundEvents: [],
    supportedOutboundActions: ["create_task", "update_owner", "add_note"],
    requiredScopes: ["api", "refresh_token"],
    optionalScopes: ["full", "id"],
    installPrerequisites: ["Salesforce org", "Connected App with OAuth"],
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest",
    iconAssetKey: "salesforce",
    healthCheckStrategy: "api_probe",
    minimumPlan: "growth",
    isTierOne: true,
  };
}
