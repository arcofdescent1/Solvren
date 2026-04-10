import type { MappingConfigV1 } from "@/lib/imports/mappingConfig";
import { normalizeMappingConfig } from "@/lib/imports/mappingConfig";
import { parseIntakeRecordType, type IntakeRecordType } from "@/lib/intake/intakeMapping";

function pick(obj: Record<string, unknown>, key: string | undefined): string {
  if (!key) return "";
  const v = obj[key];
  if (v == null) return "";
  return String(v).trim();
}

export function mapWebhookPayload(
  body: Record<string, unknown>,
  rawConfig: unknown,
  defaultIntakeRecordType: IntakeRecordType
): {
  externalRecordId: string | null;
  title: string;
  description: string;
  severity: string;
  intakeRecordType: IntakeRecordType;
} {
  const cfg = normalizeMappingConfig(rawConfig);
  const externalRecordId =
    typeof body.externalRecordId === "string" && body.externalRecordId.trim()
      ? body.externalRecordId.trim()
      : null;

  const titleKey = cfg.mappings["title"];
  const descKey = cfg.mappings["description"];
  const sevKey = cfg.mappings["severity"];

  const title = pick(body, titleKey) || pick(body, "title") || pick(body, "summary");
  const description = pick(body, descKey) || pick(body, "description") || pick(body, "details");
  const severity = pick(body, sevKey) || pick(body, "severity") || pick(body, "priority");

  let intakeRecordType = defaultIntakeRecordType;
  if (cfg.recordTypeField) {
    const rawRt = pick(body, cfg.recordTypeField);
    if (rawRt) {
      const lowered = rawRt.toLowerCase();
      const mapped = cfg.recordTypeMap?.[lowered] ?? cfg.recordTypeMap?.[lowered.replace(/ /g, "_")];
      intakeRecordType = parseIntakeRecordType(mapped ?? rawRt);
    }
  } else if (typeof body.recordType === "string") {
    intakeRecordType = parseIntakeRecordType(body.recordType);
  }

  return { externalRecordId, title, description, severity, intakeRecordType };
}
