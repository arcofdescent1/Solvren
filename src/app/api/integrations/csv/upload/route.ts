/**
 * Phase 3 — CSV upload. Store file in Supabase Storage, create integration_file_uploads record.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { parseCsv } from "@/modules/integrations/providers/csv/parser";
import { storeIntegrationFileUpload } from "@/lib/imports/integrationUpload";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

    const content = await file.text();
    const parsed = parseCsv(content, { maxRows: 1 });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
    }

    const admin = createAdminClient();
    const fullParsed = parseCsv(content);
    const uploadRow = await storeIntegrationFileUpload(admin, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      buffer: Buffer.from(content, "utf8"),
      filename: file.name,
      contentType: file.type || "text/csv",
      rowCount: fullParsed.rowCount,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        id: uploadRow.id,
        filename: uploadRow.filename,
        rowCount: uploadRow.row_count,
        createdAt: uploadRow.created_at,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
