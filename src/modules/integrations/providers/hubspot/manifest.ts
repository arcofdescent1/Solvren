/**
 * Phase 1 — HubSpot connector manifest (§14.1).
 * Tier 1: CRM, OAuth, contacts/deals/owners, tasks, webhooks.
 */
import type { ConnectorManifest } from "../../contracts";

export function getHubSpotManifest(): ConnectorManifest {
  return {
    provider: "hubspot",
    displayName: "HubSpot",
    category: "crm",
    description: "Monitor lead ownership, follow-up gaps, and deal hygiene.",
    authType: "oauth2",
    supportedSyncModes: ["polling", "webhook", "hybrid"],
    capabilities: [
      "read_objects",
      "receive_events",
      "execute_actions",
      "health_checks",
      "schema_discovery",
      "backfill",
      "incremental_sync",
    ],
    supportedObjectTypes: ["contacts", "companies", "deals", "owners", "tasks", "engagements"],
    supportedInboundEvents: ["contact.creation", "contact.propertyChange", "deal.creation", "deal.propertyChange"],
    supportedOutboundActions: ["create_task"],
    requiredScopes: ["crm.objects.contacts.read", "crm.objects.deals.read", "crm.objects.companies.read"],
    optionalScopes: ["crm.objects.contacts.write", "crm.objects.deals.write", "tickets"],
    installPrerequisites: ["HubSpot account", "Admin or OAuth scope grant"],
    docsUrl: "https://developers.hubspot.com/docs/api/overview",
    iconAssetKey: "hubspot",
    healthCheckStrategy: "hybrid",
    minimumPlan: "growth",
    isTierOne: true,
  };
}
