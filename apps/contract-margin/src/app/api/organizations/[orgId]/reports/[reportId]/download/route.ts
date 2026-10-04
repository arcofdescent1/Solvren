import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ orgId: string; reportId: string }> }) {
  const { orgId, reportId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(reportId).success)
    return jsonError("Report not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance", "engineer", "viewer"]);
  if (!session) return jsonError("Report access required.", 403);
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "csv") return jsonError("Choose PDF or CSV.", 400);
  const { data, error } = await session.supabase.from("report_snapshots")
    .select("status,csv_path,pdf_path").eq("org_id", orgId).eq("id", reportId).maybeSingle();
  if (error || !data || data.status !== "frozen") return jsonError("Frozen report not found.", 404);
  const path = format === "pdf" ? data.pdf_path : data.csv_path;
  if (!path || !path.startsWith(`${orgId}/${reportId}/`)) return jsonError("Report file unavailable.", 404);
  const { data: link, error: signError } = await adminSupabase().storage.from("margin-reports")
    .createSignedUrl(path, 24 * 3600, { download: `solvren-${reportId}.${format}` });
  if (signError || !link) return jsonError("Could not prepare a secure download.", 503);
  return Response.redirect(link.signedUrl, 302);
}
