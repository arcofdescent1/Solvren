import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { z } from "zod";
import { requestOrgRole } from "@/lib/api";
import { dateRange, exposure, PortfolioRow } from "@/lib/finance";
import { reportCsv, reportPdf, ReportPacket } from "@/lib/report-packet";
import { adminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;
type ReconciliationRow = { provider: string; status: string; reported_usd: string | null;
  attributed_usd: string; variance_usd: string | null; [key: string]: unknown };

async function pages<T>(load: (start: number, end: number) => Promise<{ data: T[] | null; error: { message: string } | null }>) {
  const result: T[] = [];
  for (let start = 0; start < 50_000; start += 1000) {
    const response = await load(start, start + 999);
    if (response.error) throw new Error(response.error.message);
    const rows = response.data ?? [];
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
  throw new Error("Report evidence exceeds the supported export volume");
}

function redirectTo(orgId: string, from: string, to: string, kind: "frozen" | "error", value: string) {
  const target = new URL(`/o/${orgId}/reconcile`, process.env.APP_ORIGIN ?? "http://localhost:3000");
  target.searchParams.set("from", from); target.searchParams.set("to", to);
  target.searchParams.set(kind, value);
  return NextResponse.redirect(target, { status: 303 });
}

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return Response.json({ error: "Organization not found" }, { status: 404 });
  const session = await requestOrgRole(orgId, ["owner", "finance"]);
  if (!session) return Response.json({ error: "Finance access with MFA required" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const from = String(form?.get("from") ?? ""); const to = String(form?.get("to") ?? "");
  const period = dateRange({ from, to });
  if (!period || to > new Date().toISOString().slice(0, 10))
    return Response.json({ error: "Choose a closed period of 1 to 62 days" }, { status: 400 });
  let reportId: string | null = null;
  const paths: string[] = [];
  try {
    const [orgResult, portfolioResult, reconciliationResult, unmapped,
      contracts, mappings, providerCostBuckets, rateCards, issues] = await Promise.all([
      session.supabase.from("organizations").select("name").eq("id", orgId).single(),
      session.supabase.rpc("phase1_portfolio", { p_org: orgId, p_start: from, p_end: to }),
      session.supabase.rpc("phase2_reconciliation", { p_org: orgId, p_start: from, p_end: to }),
      pages(async (start, end) => await session.supabase.rpc("phase1_unmapped", {
        p_org: orgId, p_start: from, p_end: to,
      }).order("source").order("source_customer_id").range(start, end)),
      pages(async (start, end) => await session.supabase.from("contract_versions")
        .select("customer_id,version,effective_from,effective_to,billing_period,base_fee_usd,included_outcomes,overage_usd,discount_pct,target_margin_pct,renewal_on")
        .eq("org_id", orgId).lt("effective_from", to)
        .or(`effective_to.is.null,effective_to.gt.${from}`).order("customer_id").order("id").range(start, end)),
      pages(async (start, end) => await session.supabase.from("customer_mappings")
        .select("source,source_customer_id,customer_id")
        .eq("org_id", orgId).order("source").order("source_customer_id").range(start, end)),
      pages(async (start, end) => await session.supabase.from("provider_cost_buckets")
        .select("provider,day,scope_id,line_item,amount_usd")
        .eq("org_id", orgId).gte("day", from).lt("day", to)
        .order("day").order("provider").order("scope_id").order("line_item").range(start, end)),
      pages(async (start, end) => await session.supabase.from("model_rates")
        .select("provider,model,effective_from,input_per_million_usd,output_per_million_usd,cache_read_per_million_usd,cache_write_per_million_usd")
        .eq("org_id", orgId).lte("effective_from", to).order("provider").order("id").range(start, end)),
      pages(async (start, end) => await session.supabase.from("margin_issues")
        .select("id,kind,status,severity,exposure_usd,assignee_user_id,first_seen_at,last_seen_at")
        .eq("org_id",orgId).lt("first_seen_at",`${to}T00:00:00Z`)
        .gte("last_seen_at",`${from}T00:00:00Z`).order("id").range(start,end)),
    ]);
    if (orgResult.error || !orgResult.data || portfolioResult.error || reconciliationResult.error)
      throw new Error("Report evidence could not be read");
    const portfolio = (portfolioResult.data ?? []) as PortfolioRow[];
    const reconciliation = (reconciliationResult.data ?? []) as ReconciliationRow[];
    const exceptions = [
      ...portfolio.filter((row) => exposure(row).gt(0)).map((row) => ({ kind: "margin floor",
        subject: row.customer_name, status: "open", detail: `${exposure(row).toFixed(2)} USD known exposure` })),
      ...portfolio.filter((row) => row.unknown_cost_events > 0).map((row) => ({ kind: "unpriced cost",
        subject: row.customer_name, status: "open", detail: `${row.unknown_cost_events} usage events` })),
      ...reconciliation.filter((row) => !["verified", "unavailable"].includes(row.status)).map((row) => ({
        kind: "supplier reconciliation", subject: row.provider, status: "open",
        detail: `${row.status}; ${row.variance_usd ?? "unknown"} USD variance`,
      })),
    ];
    const active = reconciliation.filter((row) => row.reported_usd !== null
      || new Decimal(row.attributed_usd).gt(0));
    const confidence = unmapped.length || portfolio.some((row) => row.unknown_cost_events > 0)
      ? "partial" : active.length && active.every((row) => row.status === "verified")
        ? "verified" : "provisional";
    const packet: ReportPacket = {
      organization: orgResult.data.name, periodStart: from, periodEnd: to,
      generatedAt: new Date().toISOString(), formulaVersion: "2026-10-v2", confidence,
      portfolio, reconciliation, unmapped: unmapped as Array<Record<string, unknown>>,
      contracts, mappings, providerCostBuckets,
      rateCards, issues, exceptions,
    };
    const hash = createHash("sha256").update(JSON.stringify(packet)).digest("hex");
    const db = adminSupabase();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: latest, error: latestError } = await db.from("report_snapshots")
        .select("version").eq("org_id", orgId).eq("period_start", from).eq("period_end", to)
        .order("version", { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw new Error("Could not reserve report version");
      const { data, error } = await db.from("report_snapshots").insert({
        org_id: orgId, version: (latest?.version ?? 0) + 1,
        period_start: from, period_end: to, confidence,
        snapshot: packet, snapshot_hash: hash, created_by: session.user.id,
      }).select("id").single();
      if (!error && data) { reportId = data.id; break; }
      if (error?.code !== "23505") throw new Error("Could not create report version");
    }
    if (!reportId) throw new Error("Could not reserve a unique report version");
    const csv = Buffer.from(reportCsv(packet), "utf8");
    const pdf = Buffer.from(await reportPdf(packet));
    const csvPath = `${orgId}/${reportId}/report.csv`;
    const pdfPath = `${orgId}/${reportId}/report.pdf`;
    const { error: csvError } = await db.storage.from("margin-reports")
      .upload(csvPath, csv, { contentType: "text/csv", upsert: false });
    if (csvError) throw new Error("Could not save report CSV");
    paths.push(csvPath);
    const { error: pdfError } = await db.storage.from("margin-reports")
      .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (pdfError) throw new Error("Could not save report PDF");
    paths.push(pdfPath);
    const { error: finishError } = await db.from("report_snapshots")
      .update({ status: "frozen", csv_path: csvPath, pdf_path: pdfPath,
        frozen_at: new Date().toISOString() }).eq("id", reportId).eq("status", "preparing");
    if (finishError) throw new Error("Could not finalize report packet");
    return redirectTo(orgId, from, to, "frozen", reportId);
  } catch {
    if (reportId) {
      const db = adminSupabase();
      if (paths.length) await db.storage.from("margin-reports").remove(paths);
      await db.from("report_snapshots").update({ status: "failed" }).eq("id", reportId).eq("status", "preparing");
    }
    return redirectTo(orgId, from, to, "error", "Report freeze failed. Review source health and retry.");
  }
}
