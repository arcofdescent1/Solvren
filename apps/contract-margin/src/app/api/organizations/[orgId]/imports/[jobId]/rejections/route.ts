import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(_request: Request, context: { params: Promise<{ orgId: string; jobId: string }> }) {
  const { orgId, jobId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(jobId).success)
    return jsonError("Import not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance", "engineer", "viewer"]);
  if (!session) return jsonError("Organization access required.", 403);
  const { data: job } = await session.supabase.from("import_jobs")
    .select("id").eq("id", jobId).eq("org_id", orgId).maybeSingle();
  if (!job) return jsonError("Import not found.", 404);
  const rows: Array<{ row_number: number; reason: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await session.supabase.from("import_rejections")
      .select("row_number,reason").eq("job_id", jobId).order("row_number").range(offset, offset + 999);
    if (error) return jsonError("Could not read import errors.", 503);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const body = ["row_number,reason", ...rows.map((row) =>
    `${row.row_number},${csvCell(row.reason)}`)].join("\r\n");
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="solvren-import-${jobId}-errors.csv"`,
    "Cache-Control": "private, no-store",
  } });
}
