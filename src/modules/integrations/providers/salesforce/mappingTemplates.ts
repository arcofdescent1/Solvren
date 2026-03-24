/**
 * Phase 2 — Salesforce mapping template definitions.
 */
export const SALESFORCE_MAPPING_TEMPLATES = [
  {
    provider_key: "salesforce",
    source_object_type: "Lead",
    canonical_object_type: "Customer",
    name: "Salesforce Lead → Customer",
    fields: [
      { source_path: "Id", canonical_field: "externalId" },
      { source_path: "Email", canonical_field: "email" },
      { source_path: "FirstName", canonical_field: "firstName" },
      { source_path: "LastName", canonical_field: "lastName" },
    ],
  },
  {
    provider_key: "salesforce",
    source_object_type: "Contact",
    canonical_object_type: "Customer",
    name: "Salesforce Contact → Customer",
    fields: [
      { source_path: "Id", canonical_field: "externalId" },
      { source_path: "Email", canonical_field: "email" },
      { source_path: "FirstName", canonical_field: "firstName" },
      { source_path: "LastName", canonical_field: "lastName" },
    ],
  },
  {
    provider_key: "salesforce",
    source_object_type: "Account",
    canonical_object_type: "Account",
    name: "Salesforce Account → Account",
    fields: [
      { source_path: "Id", canonical_field: "externalId" },
      { source_path: "Name", canonical_field: "name" },
    ],
  },
  {
    provider_key: "salesforce",
    source_object_type: "Opportunity",
    canonical_object_type: "FunnelStep",
    name: "Salesforce Opportunity → FunnelStep",
    fields: [
      { source_path: "Id", canonical_field: "externalId" },
      { source_path: "StageName", canonical_field: "stage" },
      { source_path: "Amount", canonical_field: "amount" },
      { source_path: "CloseDate", canonical_field: "occurredAt" },
    ],
  },
  {
    provider_key: "salesforce",
    source_object_type: "Task",
    canonical_object_type: "Event",
    name: "Salesforce Task → Event",
    fields: [
      { source_path: "Id", canonical_field: "externalId" },
      { source_path: "ActivityDate", canonical_field: "occurredAt" },
    ],
  },
];
