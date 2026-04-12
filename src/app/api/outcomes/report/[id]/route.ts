import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { createSignedReportUrl } from "@/lib/reports/uploadGeneratedReport";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";

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

    if ((r.status === "COMPLETED" || r.status === "COMPLETE") && userRes.user) {
      const { data: wrap } = await admin
        .from("org_qbr_reports")
        .select("id")
        .eq("generated_report_id", id)
        .maybeSingle();
      const wrapId = (wrap as { id?: string } | null)?.id;
      if (wrapId) {
        const exec = await isExecutiveUserForPhase1(supabase, userRes.user.id, orgId);
        if (exec) {
          const since = new Date(Date.now() - 3600000).toISOString();
          const { count: recentOpens } = await admin
            .from("audit_log")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .eq("action", "qbr_report_opened")
            .eq("entity_id", wrapId)
            .gte("created_at", since);
          if ((recentOpens ?? 0) === 0) {
            await auditLog(admin, {
              orgId,
              actorId: userRes.user.id,
              actorType: "USER",
              action: "qbr_report_opened",
              entityType: "qbr_report",
              entityId: wrapId,
              metadata: { generatedReportId: id },
            });
            await trackServerAppEvent(admin, {
              orgId,
              userId: userRes.user.id,
              event: "qbr_report_opened",
              properties: { orgQbrReportId: wrapId, generatedReportId: id },
            });
          }
        }
      }
    }

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
