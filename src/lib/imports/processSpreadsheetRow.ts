import type { SupabaseClient } from "@supabase/supabase-js";
import { createIntakeChange } from "@/lib/intake/createIntakeChange";
import { submitChangeDelegated } from "@/lib/intake/submitChangeDelegated";
import type { MappingConfigV1 } from "@/lib/imports/mappingConfig";
import { cellFromRow, resolveRecordTypeFromRow } from "@/lib/imports/mappingConfig";
import type { IntakeRecordType } from "@/lib/intake/intakeMapping";

export async function processSpreadsheetRow(args: {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  userEmail?: string | null;
  row: Record<string, string>;
  rowIndex: number;
  mapping: MappingConfigV1;
  defaultIntakeRecordType: IntakeRecordType;
  submitMode: "DRAFT" | "ACTIVE";
  requestUrl: string;
  cookieHeader: string | null;
  batchId: string;
  fileName: string;
}): Promise<{ ok: true; changeEventId: string } | { ok: false; message: string }> {
  const titleCol = args.mapping.mappings["title"];
  const descCol = args.mapping.mappings["description"];
  const sevCol = args.mapping.mappings["severity"];
  const title = cellFromRow(args.row, titleCol);
  if (!title) return { ok: false, message: "Missing title (mapped column empty)" };
  const description = cellFromRow(args.row, descCol);
  const severity = cellFromRow(args.row, sevCol);
  const intakeType = resolveRecordTypeFromRow(args.row, args.mapping, args.defaultIntakeRecordType);

  try {
    const { changeEventId } = await createIntakeChange({
      supabase: args.supabase,
      orgId: args.orgId,
      actorUserId: args.userId,
      actorEmail: args.userEmail ?? null,
      title,
      description,
      intakeRecordType: intakeType,
      sourceMode: "SPREADSHEET",
      sourceLabel: "Spreadsheet import",
      sourceReference: `import_batch:${args.batchId}:row:${args.rowIndex}`,
      intakeMetadataJson: {
        import_batch_id: args.batchId,
        row_index: args.rowIndex,
        source_file: args.fileName,
      },
      severity,
      timelineEventType: "SPREADSHEET_IMPORT_COMMITTED",
      timelineTitle: "Spreadsheet import",
      timelineDescription: `Row ${args.rowIndex} imported from ${args.fileName}`,
      timelineMetadata: { import_batch_id: args.batchId, row_index: args.rowIndex },
      auditAction: "IMPORT_ROW_PROCESSED",
    });

    if (args.submitMode === "ACTIVE") {
      const sub = await submitChangeDelegated({
        requestUrl: args.requestUrl,
        cookieHeader: args.cookieHeader,
        changeEventId,
      });
      if (!sub.ok && sub.status !== 202) {
        const msg =
          sub.json &&
          typeof sub.json === "object" &&
          "error" in sub.json &&
          typeof (sub.json as { error?: unknown }).error === "string"
            ? (sub.json as { error: string }).error
            : "Submit failed";
        return { ok: false, message: msg };
      }
    }
    return { ok: true, changeEventId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Row failed" };
  }
}
