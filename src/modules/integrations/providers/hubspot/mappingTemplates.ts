/**
 * Phase 2 — HubSpot mapping template definitions.
 * Seeds integration_mapping_templates (see migration 180).
 */
export const HUBSPOT_MAPPING_TEMPLATES = [
  {
    provider_key: "hubspot",
    source_object_type: "contacts",
    canonical_object_type: "Customer",
    name: "HubSpot Contact → Customer",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "properties.email", canonical_field: "email" },
      { source_path: "properties.firstname", canonical_field: "firstName" },
      { source_path: "properties.lastname", canonical_field: "lastName" },
    ],
  },
  {
    provider_key: "hubspot",
    source_object_type: "companies",
    canonical_object_type: "Account",
    name: "HubSpot Company → Account",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "properties.name", canonical_field: "name" },
      { source_path: "properties.domain", canonical_field: "domain" },
    ],
  },
  {
    provider_key: "hubspot",
    source_object_type: "deals",
    canonical_object_type: "FunnelStep",
    name: "HubSpot Deal → FunnelStep",
    fields: [
      { source_path: "id", canonical_field: "externalId" },
      { source_path: "properties.dealstage", canonical_field: "stage" },
      { source_path: "properties.amount", canonical_field: "amount" },
      { source_path: "properties.closedate", canonical_field: "occurredAt" },
    ],
  },
];
