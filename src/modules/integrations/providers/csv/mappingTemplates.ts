/**
 * Phase 3 — CSV mapping templates (optional starter).
 */
export const CSV_MAPPING_TEMPLATES = [
  {
    name: "CSV → Generic",
    objectType: "generic",
    fields: [
      { source_path: "id", canonical_field: "external_id", transform_chain: [{ type: "identity" }] },
      { source_path: "email", canonical_field: "email", transform_chain: [{ type: "identity" }] },
      { source_path: "name", canonical_field: "name", transform_chain: [{ type: "identity" }] },
    ],
  },
  {
    name: "CSV → Customers",
    objectType: "customers",
    fields: [
      { source_path: "customer_id", canonical_field: "external_id", transform_chain: [{ type: "identity" }] },
      { source_path: "email", canonical_field: "email", transform_chain: [{ type: "identity" }] },
      { source_path: "company", canonical_field: "company_name", transform_chain: [{ type: "identity" }] },
    ],
  },
];
