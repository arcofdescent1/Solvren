/**
 * Phase 1 — Provider schema service.
 * Returns source paths for mapping UI (Mode B — Provider Schema).
 * HubSpot: properties.X
 * Salesforce: direct field names
 */

export type ProviderSchemaField = {
  path: string;
  type: string;
  label?: string;
};

export type ProviderSchemaResult = {
  fields: ProviderSchemaField[];
};

/**
 * Format raw provider properties/fields into mapping-friendly source paths.
 * @param providerKey - hubspot | salesforce | stripe | etc
 * @param rawFields - from HubSpot getObjectProperties or Salesforce describeSobject
 */
export function formatProviderSchema(
  providerKey: string,
  rawFields: Array<{ name: string; label?: string; type?: string }>
): ProviderSchemaResult {
  const provider = providerKey.toLowerCase();
  const fields: ProviderSchemaField[] = rawFields.map((f) => {
    const path = provider === "hubspot" ? `properties.${f.name}` : f.name;
    return {
      path,
      type: f.type ?? "string",
      label: f.label ?? f.name,
    };
  });
  return { fields };
}

/**
 * Infer schema from sample JSON (Mode A).
 * Flattens nested structure into dot-notation paths.
 */
export function inferSchemaFromPayload(payload: unknown): ProviderSchemaResult {
  const fields: ProviderSchemaField[] = [];
  function walk(obj: unknown, prefix: string) {
    if (obj == null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      if (obj.length > 0) walk(obj[0], `${prefix}[0]`);
      return;
    }
    const rec = obj as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v != null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
        walk(v, path);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        fields.push({ path: `${path}[0]`, type: "object" });
        walk(v[0], `${path}[0]`);
      } else {
        fields.push({ path, type: inferType(v) });
      }
    }
  }
  walk(payload, "");
  return { fields };
}

function inferType(v: unknown): string {
  if (v == null) return "string";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") return "object";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return "date";
  return "string";
}
