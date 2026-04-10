import type { MappingConfigV1 } from "@/lib/imports/mappingConfig";

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function pickColumn(columns: string[], ...hints: string[]): string {
  for (const h of hints) {
    const hn = norm(h);
    const hit = columns.find((c) => norm(c) === hn || norm(c).includes(hn));
    if (hit) return hit;
  }
  return "";
}

/** Best-effort header → canonical mapping suggestions (Phase 3). */
export function suggestSpreadsheetMappings(columns: string[]): MappingConfigV1 {
  return {
    version: 1,
    mappings: {
      title: pickColumn(columns, "title", "summary", "subject", "name"),
      description: pickColumn(columns, "description", "details", "detail", "notes", "body"),
      severity: pickColumn(columns, "severity", "priority", "risk", "impact"),
    },
    recordTypeField: pickColumn(columns, "type", "category", "record_type", "recordtype"),
  };
}
