import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { createSignedReportUrl } from "@/lib/reports/uploadGeneratedReport";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";

type Row = {
  id: string;
  org_id: string;
  status: string;
  storage_path: string | null;
  storage_url: string | null;
  error_json: Record<string, unknown> | null;
};

/**
 * GET /api/outcomes/report/[id] — report status + fresh signed URL when complete (REVIEWER+).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createPrivilegedClient("GET /api/outcomes/report/[id]");
    const { data: row, error } = await admin.from("generated_reports").select("*").eq("id", id).maybeSingle();
    if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const r = row as Row;
    const orgId = parseRequestedOrgId(r.org_id);
    await requireOrgPermission(orgId, "change.approve");

    let storageUrl: string | null = null;
    if (r.status === "COMPLETED" || r.status === "COMPLETE") {
      if (r.storage_path) {
        const signed = await createSignedReportUrl(admin, r.storage_path, 604800);
        storageUrl = signed.url;
      } else {
        storageUrl = r.storage_url;
      }
    }

    const errMsg =
      r.error_json && typeof r.error_json.message === "string" ? r.error_json.message : undefined;

    return NextResponse.json({
      id: r.id,
      status: r.status,
      storageUrl: storageUrl ?? undefined,
      error: errMsg,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
