/**
 * Phase 2 — Salesforce schema discovery.
 */
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import type { ProviderSchemaResult } from "../../contracts/runtime";
import { formatProviderSchema } from "@/lib/integrations/mapping/providerSchemaService";

const OBJECT_TYPES = [
  { key: "Lead", label: "Lead", syncable: true },
  { key: "Contact", label: "Contact", syncable: true },
  { key: "Account", label: "Account", syncable: true },
  { key: "Opportunity", label: "Opportunity", syncable: true },
  { key: "Task", label: "Task", syncable: true },
];

export async function fetchSalesforceSchema(client: SalesforceClient): Promise<ProviderSchemaResult> {
  const objectFields: Record<string, Array<{ path: string; type: string; label?: string }>> = {};
  for (const obj of OBJECT_TYPES) {
    try {
      const { fields } = await client.describeSobject(obj.key);
      const { fields: formatted } = formatProviderSchema("salesforce", fields);
      objectFields[obj.key] = formatted;
    } catch {
      objectFields[obj.key] = [];
    }
  }
  return {
    objectTypes: OBJECT_TYPES,
    objectFields,
  };
}
