import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanImportSpreadsheet } from "@/lib/server/intakeAuthz";
import { parseSpreadsheetBuffer } from "@/lib/imports/parseSpreadsheet";
import { storeIntegrationFileUpload } from "@/lib/imports/integrationUpload";
import { suggestSpreadsheetMappings } from "@/lib/imports/suggestMappings";
import { SPREADSHEET_PREVIEW_TTL_MS } from "@/lib/imports/spreadsheetLimits";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const orgIdRaw = String(formData.get("orgId") ?? req.nextUrl.searchParams.get("orgId") ?? "").trim();
    const ctx = await requireOrgMembership(parseRequestedOrgId(orgIdRaw));
    assertCanImportSpreadsheet(ctx.role);
    const file = formData.get("file") as File | null;
    const sheetIndexRaw = formData.get("sheetIndex");
    const sheetIndex =
      typeof sheetIndexRaw === "string" && sheetIndexRaw.trim() !== ""
        ? Math.max(0, parseInt(sheetIndexRaw, 10) || 0)
        : 0;

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSpreadsheetBuffer({
      buffer: buf,
      filename: file.name || "upload",
      sheetIndex,
    });

    if (parsed.result.errors.some((e) => e.row === 0)) {
      return NextResponse.json(
        { error: parsed.result.errors[0]?.message ?? "Invalid file" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const contentType =
      file.type ||
      (parsed.sourceType === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv");

    const { id: uploadId } = await storeIntegrationFileUpload(admin, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      buffer: buf,
      filename: file.name || (parsed.sourceType === "XLSX" ? "upload.xlsx" : "upload.csv"),
      contentType,
      rowCount: parsed.result.rowCount,
    });

    const expires = new Date(Date.now() + SPREADSHEET_PREVIEW_TTL_MS).toISOString();
    const suggestedMapping = suggestSpreadsheetMappings(parsed.result.columns);

    const { data: batch, error: bErr } = await ctx.supabase
      .from("import_batches")
      .insert({
        org_id: ctx.orgId,
        created_by_user_id: ctx.user.id,
        integration_file_upload_id: uploadId,
        source_type: parsed.sourceType,
        workflow_mode: "DRAFT",
        status: "PREVIEW",
        file_name: file.name || "upload",
        total_rows: parsed.result.rowCount,
        preview_expires_at: expires,
        mapping_snapshot_json: { sheetIndex, suggestedMapping },
        warning_summary_json: { parse_warnings: parsed.warnings },
      })
      .select("id")
      .single();

    if (bErr || !batch)
      return NextResponse.json({ error: bErr?.message ?? "batch failed" }, { status: 500 });

    const previewToken = (batch as { id: string }).id;

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "IMPORT_PREVIEW_CREATED",
      entityType: "import_batch",
      entityId: previewToken,
      metadata: { row_count: parsed.result.rowCount, source_type: parsed.sourceType },
    });

    const sampleRows = parsed.result.rows.slice(0, 10);
    return NextResponse.json({
      ok: true,
      previewToken,
      previewExpiresAt: expires,
      columns: parsed.result.columns,
      sampleRows,
      suggestedMapping,
      sheetNames: parsed.sheetNames ?? null,
      rowCount: parsed.result.rowCount,
      warnings: parsed.warnings,
      parseErrors: parsed.result.errors,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
