import { timingSafeEqual } from "node:crypto";
import { adminSupabase } from "@/lib/supabase/admin";
import { fetchCostDay, CostProvider } from "@/lib/provider-cost";
import { fetchStripePage, StripeStage } from "@/lib/stripe-revenue";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(secret); const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Database = ReturnType<typeof adminSupabase>;
type Claim = { message_id: number; read_count: number; job_id: string };
type Job = { id: string; org_id: string; provider: "openai" | "anthropic" | "stripe";
  day: string | null; status: string; stage: string; cursor: string | null };

async function processStripe(db: Database, claim: Claim, job: Job, key: string) {
  const stage = job.stage as StripeStage;
  if (!["customers", "subscriptions", "invoices"].includes(stage))
    throw new Error("Stripe sync stage is invalid");
  const page = await fetchStripePage(key, stage, job.cursor);
  if (page.hasMore && page.cursor === job.cursor) throw new Error("Stripe cursor did not advance");
  if (stage !== "customers") {
    const ids = [...new Set(page.rows.map((row) => row.stripe_customer_id))];
    if (ids.length) {
      const { error } = await db.rpc("stage_stripe_customer_refs", {
        p_org: job.org_id, p_job: job.id, p_customer_ids: ids,
      });
      if (error) throw new Error("Could not stage Stripe customer references");
    }
  }
  if (page.rows.length) {
    const table = stage === "customers" ? "stripe_customers"
      : stage === "subscriptions" ? "stripe_subscriptions" : "stripe_invoices";
    const rows = page.rows.map((row) => ({ ...row, org_id: job.org_id,
      last_seen_job: job.id, updated_at: new Date().toISOString() }));
    const conflict = stage === "customers" ? "org_id,stripe_customer_id"
      : stage === "subscriptions" ? "org_id,stripe_subscription_id" : "org_id,stripe_invoice_id";
    const { error } = await db.from(table).upsert(rows, { onConflict: conflict });
    if (error) throw new Error(`Could not save Stripe ${stage}`);
  }
  const nextStage = page.hasMore ? stage : stage === "customers" ? "subscriptions"
    : stage === "subscriptions" ? "invoices" : "complete";
  const { error } = await db.rpc("checkpoint_stripe_job", {
    p_message: claim.message_id, p_job: job.id, p_stage: nextStage,
    p_cursor: page.hasMore ? page.cursor : null, p_count: page.rows.length,
  });
  if (error) throw new Error("Could not checkpoint Stripe sync");
}

async function processClaim(db: Database, claim: Claim) {
  const { data, error } = await db.from("connector_jobs")
    .select("id,org_id,provider,day,status,stage,cursor").eq("id", claim.job_id).single();
  if (error || !data) throw new Error("Connector job is unavailable");
  const job = data as Job;
  if (!["queued", "running"].includes(job.status))
    throw new Error("Connector job is no longer active");
  const { data: secret, error: secretError } = await db.rpc("read_connector_credential_for_worker", {
    p_org: job.org_id, p_provider: job.provider,
  });
  if (secretError || !secret) throw new Error("Connection credential is unavailable");
  if (job.provider === "stripe") return processStripe(db, claim, job, secret);
  if (!job.day) throw new Error("Provider day is missing");
  const rows = await fetchCostDay(job.provider as CostProvider, secret, job.day);
  const { error: finishError } = await db.rpc("complete_provider_cost_day", {
    p_message: claim.message_id, p_job: job.id, p_rows: rows,
  });
  if (finishError) throw new Error("Could not commit provider cost day");
}

async function runWorker(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let db: Database;
  try { db = adminSupabase(); }
  catch { return Response.json({ error: "Worker is not configured" }, { status: 503 }); }
  const { error: scheduleError } = await db.rpc("schedule_connector_refreshes");
  if (scheduleError) return Response.json({ error: "Could not schedule connector refreshes" }, { status: 503 });
  let processed = 0; let failed = 0;
  const until = Date.now() + 42_000;
  while (processed + failed < 8 && Date.now() < until) {
    const { data, error } = await db.rpc("claim_connector_job");
    if (error) return Response.json({ error: "Could not claim connector job", processed, failed }, { status: 503 });
    const claim = data?.[0] as Claim | undefined;
    if (!claim) break;
    try { await processClaim(db, claim); processed++; }
    catch (error) {
      failed++;
      const reason = error instanceof Error && /^(openai|anthropic) cost API returned HTTP [45]\d\d$|^Stripe (customers|subscriptions|invoices) API returned HTTP [45]\d\d$|^Connection credential is unavailable$|^Connector job is no longer active$/.test(error.message)
        ? error.message : "Connector sync failed; inspect provider credentials and retry";
      await db.rpc("fail_connector_job", { p_message: claim.message_id,
        p_job: claim.job_id, p_error: reason, p_read_count: claim.read_count });
    }
  }
  return Response.json({ processed, failed });
}

export const GET = runWorker;
export const POST = runWorker;
