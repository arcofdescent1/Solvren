import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanImportSpreadsheet } from "@/lib/server/intakeAuthz";
import { parseSpreadsheetBuffer } from "@/lib/imports/parseSpreadsheet";
import { downloadIntegrationUpload } from "@/lib/imports/integrationUpload";
import { normalizeMappingConfig } from "@/lib/imports/mappingConfig";
import { processSpreadsheetRow } from "@/lib/imports/processSpreadsheetRow";
import { parseIntakeRecordType } from "@/lib/intake/intakeMapping";
import {
  SPREADSHEET_ASYNC_THRESHOLD,
  SPREADSHEET_CHUNK_SIZE,
} from "@/lib/imports/spreadsheetLimits";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  previewToken: z.string().uuid(),
  submitMode: z.enum(["DRAFT", "ACTIVE"]),
  defaultIntakeRecordType: z.string().optional(),
  sheetIndex: z.number().int().min(0).optional(),
  mapping: z.object({
    version: z.number().optional(),
    mappings: z.record(z.string(), z.string()),
    recordTypeField: z.string().optional(),
    recordTypeMap: z.record(z.string(), z.string()).optional(),
  }),
});

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const ctx = await requireOrgMembership(orgId);
    assertCanImportSpreadsheet(ctx.role);

    const admin = createAdminClient();
    const { data: batch, error: bErr } = await admin
      .from("import_batches")
      .select("*")
      .eq("id", parsed.data.previewToken)
      .maybeSingle();

    if (bErr || !batch)
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    const b = batch as {
      org_id: string;
      created_by_user_id: string;
      status: string;
      preview_expires_at: string | null;
      integration_file_upload_id: string | null;
      file_name: string;
    };

    if (b.org_id !== orgId) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (b.created_by_user_id !== ctx.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (b.status !== "PREVIEW")
      return NextResponse.json({ error: "Preview is no longer valid" }, { status: 400 });
    if (b.preview_expires_at && new Date(b.preview_expires_at) < new Date()) {
      return NextResponse.json({ error: "Preview expired" }, { status: 410 });
    }
    if (!b.integration_file_upload_id)
      return NextResponse.json({ error: "Missing upload reference" }, { status: 400 });

    const { data: upload, error: uErr } = await admin
      .from("integration_file_uploads")
      .select("storage_path, filename")
      .eq("id", b.integration_file_upload_id)
      .single();
    if (uErr || !upload)
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const storagePath = (upload as { storage_path: string }).storage_path;
    const filename =
      (upload as { filename?: string | null }).filename?.trim() ||
      (batch as { file_name?: string }).file_name?.trim() ||
      "upload.csv";
    const buffer = await downloadIntegrationUpload(admin, storagePath);

    const sheetIndex = parsed.data.sheetIndex ?? 0;
    const reparse = await parseSpreadsheetBuffer({
      buffer,
      filename,
      sheetIndex,
    });
    if (reparse.result.errors.some((e) => e.row === 0)) {
      return NextResponse.json(
        { error: reparse.result.errors[0]?.message ?? "Could not parse file" },
        { status: 400 }
      );
    }

    const rows = reparse.result.rows;
    const mapping = normalizeMappingConfig(parsed.data.mapping);
    const defaultIntakeRecordType = parseIntakeRecordType(parsed.data.defaultIntakeRecordType);
    const submitMode = parsed.data.submitMode;
    const cookie = req.headers.get("cookie") ?? "";
    const url = req.url;

    const snapshot = {
      sheetIndex,
      mapping,
      defaultIntakeRecordType,
      submitMode,
      rowCount: rows.length,
    };

    await auditLog(ctx.supabase, {
      orgId,
      actorId: ctx.user.id,
      action: "IMPORT_BATCH_COMMITTED",
      entityType: "import_batch",
      entityId: parsed.data.previewToken,
      metadata: { total_rows: rows.length, async: rows.length > SPREADSHEET_ASYNC_THRESHOLD },
    });

    if (rows.length > SPREADSHEET_ASYNC_THRESHOLD) {
      const { error: upErr } = await admin
        .from("import_batches")
        .update({
          workflow_mode: submitMode,
          mapping_snapshot_json: snapshot,
          total_rows: rows.length,
          status: "QUEUED",
          preview_expires_at: null,
          progress_json: { nextRowIndex: 0, chunkSize: SPREADSHEET_CHUNK_SIZE },
          imported_rows: 0,
          failed_rows: 0,
          failed_row_details_json: [],
        })
        .eq("id", parsed.data.previewToken);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        queued: true,
        batchId: parsed.data.previewToken,
        totalRows: rows.length,
        message: "Import queued; poll batch status and call the process endpoint until complete.",
      });
    }

    const failedDetails: { row: number; message: string }[] = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const res = await processSpreadsheetRow({
        supabase: ctx.supabase,
        orgId,
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? null,
        row,
        rowIndex: i + 1,
        mapping,
        defaultIntakeRecordType,
        submitMode,
        requestUrl: url,
        cookieHeader: cookie,
        batchId: parsed.data.previewToken,
        fileName: filename,
      });
      if (res.ok) imported += 1;
      else {
        failed += 1;
        if (failedDetails.length < 500) failedDetails.push({ row: i + 1, message: res.message });
      }
    }

    const status =
      failed > 0 && imported > 0
        ? "COMPLETE_WITH_WARNINGS"
        : failed === rows.length
          ? "FAILED"
          : "COMPLETE";

    const { error: finErr } = await admin
      .from("import_batches")
      .update({
        workflow_mode: submitMode,
        mapping_snapshot_json: snapshot,
        total_rows: rows.length,
        imported_rows: imported,
        failed_rows: failed,
        failed_row_details_json: failedDetails,
        status,
        preview_expires_at: null,
        completed_at: new Date().toISOString(),
        progress_json: null,
      })
      .eq("id", parsed.data.previewToken);

    if (finErr) return NextResponse.json({ error: finErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      queued: false,
      batchId: parsed.data.previewToken,
      totalRows: rows.length,
      importedRows: imported,
      failedRows: failed,
      failedDetails,
      status,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
