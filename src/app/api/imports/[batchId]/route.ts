import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanImportSpreadsheet } from "@/lib/server/intakeAuthz";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ batchId: string }> }
) {
  try {
    const url = new URL(req.url);
    const orgId = parseRequestedOrgId(url.searchParams.get("orgId"));
    const session = await requireOrgMembership(orgId);
    assertCanImportSpreadsheet(session.role);

    const { batchId } = await ctx.params;
    const admin = createAdminClient();
    const { data: batch, error } = await admin
      .from("import_batches")
      .select(
        "id, org_id, created_by_user_id, status, total_rows, imported_rows, failed_rows, progress_json, failed_row_details_json, completed_at, file_name, workflow_mode"
      )
      .eq("id", batchId)
      .maybeSingle();

    if (error || !batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = batch as { org_id: string; created_by_user_id: string };
    if (b.org_id !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (b.created_by_user_id !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ ok: true, batch });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
