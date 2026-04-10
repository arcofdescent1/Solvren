import type { IntakeRecordType } from "@/lib/intake/intakeMapping";
import { parseIntakeRecordType } from "@/lib/intake/intakeMapping";

/** Versioned mapping config for spreadsheet + custom sources (Phase 3). */
export type MappingConfigV1 = {
  version: 1;
  recordTypeField?: string;
  /** canonical field → source column name */
  mappings: Record<string, string>;
  /** raw cell value (lowered) → IntakeRecordType */
  recordTypeMap?: Record<string, string>;
};

export type MappingConfig = MappingConfigV1;

export function normalizeMappingConfig(raw: unknown): MappingConfigV1 {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const version = Number(o.version ?? 1);
  const mappings =
    o.mappings && typeof o.mappings === "object" && !Array.isArray(o.mappings)
      ? (o.mappings as Record<string, string>)
      : {};
  const recordTypeMap =
    o.recordTypeMap && typeof o.recordTypeMap === "object" && !Array.isArray(o.recordTypeMap)
      ? (o.recordTypeMap as Record<string, string>)
      : undefined;
  return {
    version: version === 1 ? 1 : 1,
    recordTypeField: typeof o.recordTypeField === "string" ? o.recordTypeField : undefined,
    mappings,
    recordTypeMap,
  };
}

export function resolveRecordTypeFromRow(
  row: Record<string, string>,
  config: MappingConfigV1,
  defaultType: IntakeRecordType
): IntakeRecordType {
  const field = config.recordTypeField?.trim();
  if (!field) return defaultType;
  const raw = String(row[field] ?? "").trim().toLowerCase();
  if (!raw) return defaultType;
  const mapped = config.recordTypeMap?.[raw] ?? config.recordTypeMap?.[raw.replace(/ /g, "_")];
  if (mapped) return parseIntakeRecordType(mapped);
  return parseIntakeRecordType(raw);
}

export function cellFromRow(row: Record<string, string>, columnName: string | undefined): string {
  if (!columnName) return "";
  return String(row[columnName] ?? "").trim();
}
