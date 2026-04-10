/**
 * Phase 4: Process slack_interactive_jobs (approve/reject after fast Slack ack).
 * Run every 1–2 minutes alongside slack deliveries.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";
import {
  processSlackApprovalInteractiveJob,
  type SlackInteractiveJobPayload,
} from "@/lib/slack/approvalActions";

const MAX_BATCH = 25;

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("slack_interactive_jobs")
    .select("id, payload_json, attempt_count")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    logError("slack.interactive_jobs.fetch_failed", new Error(error.message));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  for (const row of rows) {
    const id = row.id as string;
    const attempt = (row.attempt_count ?? 0) + 1;

    try {
      const payload = row.payload_json as SlackInteractiveJobPayload;
      await processSlackApprovalInteractiveJob(admin, payload);
      await admin
        .from("slack_interactive_jobs")
        .update({
          status: "DONE",
          processed_at: now,
          last_error: null,
          attempt_count: attempt,
        })
        .eq("id", id);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("slack_interactive_jobs")
        .update({
          status: attempt >= 5 ? "FAILED" : "PENDING",
          last_error: msg.slice(0, 500),
          attempt_count: attempt,
        })
        .eq("id", id);
      logError("slack.interactive_jobs.process_failed", e instanceof Error ? e : new Error(msg), {
        jobId: id,
      });
    }
  }

  logInfo("slack.interactive_jobs.completed", { processed });
  return NextResponse.json({ ok: true, processed });
}
