import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { SPREADSHEET_CHUNK_SIZE } from "@/lib/imports/spreadsheetLimits";

export async function POST(
  req: Request,
  routeCtx: { params: Promise<{ batchId: string }> }
) {
  try {
    const url = new URL(req.url);
    const orgId = parseRequestedOrgId(url.searchParams.get("orgId"));
    const session = await requireOrgMembership(orgId);
    assertCanImportSpreadsheet(session.role);

    const { batchId } = await routeCtx.params;
    const admin = createAdminClient();
    const { data: batch, error: bErr } = await admin
      .from("import_batches")
      .select("*")
      .eq("id", batchId)
      .maybeSingle();

    if (bErr || !batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = batch as {
      org_id: string;
      created_by_user_id: string;
      status: string;
      integration_file_upload_id: string | null;
      file_name: string;
      mapping_snapshot_json: Record<string, unknown> | null;
      progress_json: { nextRowIndex?: number; chunkSize?: number } | null;
      imported_rows: number;
      failed_rows: number;
      failed_row_details_json: { row: number; message: string }[] | null;
    };

    if (b.org_id !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (b.created_by_user_id !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (b.status !== "QUEUED" && b.status !== "PROCESSING") {
      return NextResponse.json({ error: "Batch is not queued for processing" }, { status: 400 });
    }
    if (!b.integration_file_upload_id)
      return NextResponse.json({ error: "Missing upload" }, { status: 400 });

    const snap = b.mapping_snapshot_json ?? {};
    const mapping = normalizeMappingConfig(snap.mapping ?? { version: 1, mappings: {} });
    const defaultIntakeRecordType = parseIntakeRecordType(
      typeof snap.defaultIntakeRecordType === "string" ? snap.defaultIntakeRecordType : "OTHER"
    );
    const submitMode = snap.submitMode === "ACTIVE" ? "ACTIVE" : "DRAFT";
    const sheetIndex = typeof snap.sheetIndex === "number" ? snap.sheetIndex : 0;

    const { data: upload, error: uErr } = await admin
      .from("integration_file_uploads")
      .select("storage_path, filename")
      .eq("id", b.integration_file_upload_id)
      .single();
    if (uErr || !upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const storagePath = (upload as { storage_path: string }).storage_path;
    const filename =
      (upload as { filename?: string | null }).filename?.trim() || b.file_name?.trim() || "upload.csv";
    const buffer = await downloadIntegrationUpload(admin, storagePath);
    const reparse = await parseSpreadsheetBuffer({ buffer, filename, sheetIndex });
    const rows = reparse.result.rows;

    const progress = b.progress_json ?? {};
    let next = Number(progress.nextRowIndex ?? 0);
    const chunkSize = Number(progress.chunkSize ?? SPREADSHEET_CHUNK_SIZE);

    if (b.status === "QUEUED") {
      await admin.from("import_batches").update({ status: "PROCESSING" }).eq("id", batchId);
    }

    const failedDetails = [...(b.failed_row_details_json ?? [])];
    let imported = b.imported_rows;
    let failed = b.failed_rows;
    const cookie = req.headers.get("cookie") ?? "";

    const end = Math.min(next + chunkSize, rows.length);
    for (let i = next; i < end; i++) {
      const row = rows[i]!;
      const res = await processSpreadsheetRow({
        supabase: session.supabase,
        orgId,
        userId: session.user.id,
        userEmail: session.user.email ?? null,
        row,
        rowIndex: i + 1,
        mapping,
        defaultIntakeRecordType,
        submitMode,
        requestUrl: req.url,
        cookieHeader: cookie,
        batchId,
        fileName: filename,
      });
      if (res.ok) imported += 1;
      else {
        failed += 1;
        if (failedDetails.length < 500) failedDetails.push({ row: i + 1, message: res.message });
      }
    }

    next = end;
    const done = next >= rows.length;
    const status =
      done && failed > 0 && imported > 0
        ? "COMPLETE_WITH_WARNINGS"
        : done && failed === rows.length
          ? "FAILED"
          : done
            ? "COMPLETE"
            : "PROCESSING";

    await admin
      .from("import_batches")
      .update({
        imported_rows: imported,
        failed_rows: failed,
        failed_row_details_json: failedDetails,
        progress_json: done ? null : { nextRowIndex: next, chunkSize },
        status,
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", batchId);

    return NextResponse.json({
      ok: true,
      done,
      nextRowIndex: done ? rows.length : next,
      totalRows: rows.length,
      importedRows: imported,
      failedRows: failed,
      status,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
