/**
 * Phase 3 — CSV upload. Store file in Supabase Storage, create integration_file_uploads record.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { parseCsv } from "@/modules/integrations/providers/csv/parser";

const BUCKET = "integration-uploads";
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
    const path = `${ctx.orgId}/csv/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, content, {
      contentType: file.type || "text/csv",
      upsert: false,
    });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const fullParsed = parseCsv(content);
    const { data: uploadRow, error: insertErr } = await admin
      .from("integration_file_uploads")
      .insert({
        org_id: ctx.orgId,
        integration_account_id: null,
        storage_path: path,
        filename: file.name,
        content_type: file.type || "text/csv",
        row_count: fullParsed.rowCount,
        status: "uploaded",
        uploaded_by: ctx.user.id,
      })
      .select("id, filename, row_count, created_at")
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      upload: {
        id: (uploadRow as { id: string }).id,
        filename: (uploadRow as { filename: string }).filename,
        rowCount: (uploadRow as { row_count: number }).row_count,
        createdAt: (uploadRow as { created_at: string }).created_at,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
