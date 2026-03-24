/**
 * Phase 3 — Process uploaded CSV: map and ingest.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { processCsvFile } from "@/modules/integrations/providers/csv/sync";

const BUCKET = "integration-uploads";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { orgId?: string; objectType?: string };
    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    const admin = createAdminClient();
    const { data: upload, error: fetchErr } = await admin
      .from("integration_file_uploads")
      .select("storage_path, org_id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .single();

    if (fetchErr || !upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const row = upload as { storage_path: string };
    const { data: fileData, error: downloadErr } = await admin.storage.from(BUCKET).download(row.storage_path);
    if (downloadErr || !fileData) return NextResponse.json({ error: "File not found in storage" }, { status: 404 });

    const content = await fileData.text();
    const objectType = body.objectType ?? "generic";

    await admin
      .from("integration_file_uploads")
      .update({ status: "processing" })
      .eq("id", id);

    const result = await processCsvFile({
      admin,
      orgId: ctx.orgId,
      integrationAccountId: null,
      storagePath: row.storage_path,
      content,
      objectType,
    });

    await admin
      .from("integration_file_uploads")
      .update({
        status: result.errors.length === result.rowsProcessed ? "failed" : "processed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      result: {
        rowsProcessed: result.rowsProcessed,
        rowsMapped: result.rowsMapped,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 10),
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
