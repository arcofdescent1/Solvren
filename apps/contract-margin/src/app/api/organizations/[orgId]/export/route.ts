import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";
import { adminSupabase } from "@/lib/supabase/admin";

const sources = {
  customers: { table: "customers", key: "id", limit: 5000 },
  mappings: { table: "customer_mappings", key: "export_id", limit: 5000 },
  contracts: { table: "contract_versions", key: "id", limit: 5000 },
  rates: { table: "model_rates", key: "id", limit: 5000 },
  usage: { table: "usage_events", key: "id", limit: 5000 },
  outcomes: { table: "outcome_events", key: "id", limit: 5000 },
  direct_costs: { table: "direct_cost_events", key: "id", limit: 5000 },
  statements: { table: "provider_statements", key: "id", limit: 5000 },
  provider_costs: { table: "provider_cost_buckets", key: "export_id", limit: 5000 },
  provider_days: { table: "provider_cost_days", key: "export_id", limit: 5000 },
  stripe_customers: { table: "stripe_customers", key: "export_id", limit: 5000 },
  stripe_subscriptions: { table: "stripe_subscriptions", key: "export_id", limit: 5000 },
  stripe_invoices: { table: "stripe_invoices", key: "export_id", limit: 5000 },
  reports: { table: "report_snapshots", key: "id", limit: 1 },
  quote_decisions: { table: "quote_decisions", key: "id", limit: 1000 },
  margin_issues: { table: "margin_issues", key: "id", limit: 5000 },
  issue_events: { table: "margin_issue_events", key: "id", limit: 5000 },
  alert_settings: { table: "margin_alert_settings", key: "org_id", limit: 1 },
  alert_deliveries: { table: "margin_alert_deliveries", key: "id", limit: 5000 },
  executive_digests: { table: "executive_digests", key: "id", limit: 1000 },
} as const;

function csvCell(value: unknown) {
  const plain = value === null || value === undefined ? ""
    : typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@\t\r]/.test(plain) ? `'${plain}` : plain;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance", "engineer", "viewer"]);
  if (!session) return jsonError("Organization access required.", 403);
  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "";
  if (!(dataset in sources)) return jsonError("Choose an export dataset.", 400);
  const config = sources[dataset as keyof typeof sources];
  const cursor = url.searchParams.get("after");
  if (cursor && !/^(?:\d+|[0-9a-f-]{36})$/.test(cursor)) return jsonError("Invalid export cursor.", 400);
  let query = session.supabase.from(config.table).select("*").eq("org_id", orgId)
    .order(config.key, { ascending: true }).limit(config.limit);
  if (cursor) query = query.gt(config.key, cursor);
  const { data, error } = await query;
  if (error) return jsonError("Could not read export data.", 503);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const columns = rows.length ? Object.keys(rows[0]) : ["org_id"];
  const csv = `\uFEFF${columns.map(csvCell).join(",")}\r\n${rows.map((row) =>
    columns.map((column) => csvCell(row[column])).join(",")).join("\r\n")}${rows.length ? "\r\n" : ""}`;
  const next = rows.length === config.limit ? String(rows.at(-1)?.[config.key] ?? "") : "";
  const {error:auditError}=await adminSupabase().rpc("phase4_record_audit",{
    p_org:orgId,p_actor:session.user.id,p_type:"export",p_entity:dataset,
    p_details:{rows:rows.length,continued:!!cursor},
  });
  if(auditError)return jsonError("Could not record the export audit event.",503);
  return new Response(csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="solvren-${dataset}-${Date.now()}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Next-Cursor": next,
  } });
}
