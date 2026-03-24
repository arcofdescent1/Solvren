/**
 * Phase 3 — Preview CSV upload (first N rows).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { previewCsv } from "@/modules/integrations/providers/csv/parser";

const BUCKET = "integration-uploads";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "25", 10), 100);
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view");

    const admin = createAdminClient();
    const { data: upload, error: fetchErr } = await admin
      .from("integration_file_uploads")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single();

    if (fetchErr || !upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const { data: fileData, error: downloadErr } = await admin.storage.from(BUCKET).download((upload as { storage_path: string }).storage_path);
    if (downloadErr || !fileData) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const content = await fileData.text();
    const result = previewCsv(content, limit);

    return NextResponse.json({
      ok: true,
      rows: result.rows,
      columns: result.columns,
      rowCount: result.rowCount,
      errors: result.errors,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
