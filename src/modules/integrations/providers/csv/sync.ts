/**
 * Phase 3 — CSV sync: process uploaded file through mapping → ingestion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";
import { parseCsv } from "./parser";
import type { IntegrationProvider } from "../../contracts/types";

export type ProcessCsvInput = {
  admin: SupabaseClient;
  orgId: string;
  integrationAccountId: string | null;
  storagePath: string;
  content: string;
  objectType: string;
  delimiter?: string;
  maxRows?: number;
};

export type ProcessCsvResult = {
  rowsProcessed: number;
  rowsMapped: number;
  errors: { row: number; message: string }[];
};

export async function processCsvFile(input: ProcessCsvInput): Promise<ProcessCsvResult> {
  const { admin, orgId, integrationAccountId, content, objectType, delimiter, maxRows = 100_000 } = input;
  const parsed = parseCsv(content, { delimiter, maxRows });
  let rowsMapped = 0;
  const errors: { row: number; message: string }[] = [...parsed.errors];

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header
    try {
      const mapped = await mapPayloadToCanonicalForIngestion(admin, {
        orgId,
        providerKey: "csv",
        sourceObjectType: objectType,
        payload: row,
      });

      if (mapped.mapped) {
        const extId = (row.id ?? row.ID ?? row.Id ?? row.row_id ?? String(i)) as string;
        const res = await persistWebhookToRawEvents(admin, {
          orgId,
          integrationAccountId,
          provider: "csv" as IntegrationProvider,
          sourceChannel: "file_import",
          externalEventId: `csv-${extId}`,
          externalObjectType: objectType,
          externalObjectId: extId,
          eventType: `${objectType}.csv_import`,
          payload: row as Record<string, unknown>,
          canonicalOutput: mapped.canonical,
        });
        if (!("error" in res)) rowsMapped++;
      }
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return {
    rowsProcessed: parsed.rows.length,
    rowsMapped,
    errors,
  };
}
