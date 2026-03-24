/**
 * Phase 2 — HubSpot schema discovery.
 */
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import type { ProviderSchemaResult } from "../../contracts/runtime";
import { formatProviderSchema } from "@/lib/integrations/mapping/providerSchemaService";

const OBJECT_TYPES = [
  { key: "contacts", label: "Contacts", syncable: true },
  { key: "companies", label: "Companies", syncable: true },
  { key: "deals", label: "Deals", syncable: true },
  { key: "owners", label: "Owners", syncable: false },
  { key: "tasks", label: "Tasks", syncable: true },
  { key: "engagements", label: "Engagements", syncable: true },
];

export async function fetchHubSpotSchema(
  client: HubSpotClient
): Promise<ProviderSchemaResult> {
  const objectFields: Record<string, Array<{ path: string; type: string; label?: string }>> = {};
  for (const obj of OBJECT_TYPES.filter((o) => o.syncable)) {
    try {
      const { properties } = await client.getObjectProperties(obj.key);
      const { fields } = formatProviderSchema("hubspot", properties);
      objectFields[obj.key] = fields;
    } catch {
      objectFields[obj.key] = [];
    }
  }
  return {
    objectTypes: OBJECT_TYPES,
    objectFields,
  };
}
