/**
 * IES: Process slack_message_deliveries (pending/retrying).
 * Cron: run every 1–2 min.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverSlack } from "@/services/notifications/deliverSlack";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";

const MAX_BATCH = 30;
const MAX_ATTEMPTS = 5;

const RETRYABLE_ERRORS = [
  "timeout",
  "rate_limited",
  "slack_5xx",
  "request_timeout",
  "over_capacity",
];

const NON_RETRYABLE_ERRORS = [
  "invalid_auth",
  "account_inactive",
  "channel_not_found",
  "not_in_channel",
  "missing_scope",
  "user_not_found",
];

function isRetryable(errorCode: string): boolean {
  const code = errorCode.toLowerCase();
  if (NON_RETRYABLE_ERRORS.some((e) => code.includes(e))) return false;
  if (RETRYABLE_ERRORS.some((e) => code.includes(e))) return true;
  // Slack 429, 5xx, network errors
  return code.includes("429") || code.includes("5") || code.includes("timeout");
}

function nextRetryAt(attempt: number): string {
  const mins = [1, 5, 15, 60, 360][Math.min(attempt, 4)] ?? 360;
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("slack_message_deliveries")
    .select(
      "id, org_id, payload, slack_channel_id, message_type, destination_id, attempt_count"
    )
    .in("status", ["pending", "retrying"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    logError("slack.deliveries.process.fetch_failed", new Error(error.message));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", row.org_id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!install?.bot_token) {
      await admin
        .from("slack_message_deliveries")
        .update({
          status: "failed",
          error_code: "slack_not_installed",
          error_message: "Slack app not installed or inactive",
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", row.id);
      processed += 1;
      continue;
    }

    const p = (row.payload ?? {}) as {
      method?: string;
      args?: Record<string, unknown>;
      meta?: Record<string, unknown>;
    };

    if (!p?.method || !p?.args) {
      await admin
        .from("slack_message_deliveries")
        .update({
          status: "failed",
          error_message: "Invalid payload: missing method or args",
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", row.id);
      processed += 1;
      continue;
    }

    try {
      const json = await deliverSlack({
        botToken: install.bot_token,
        payload: p,
      });

      const ts = (json as { ts?: string })?.ts ?? null;
      const channel = (json as { channel?: string })?.channel ?? row.slack_channel_id;

      await admin
        .from("slack_message_deliveries")
        .update({
          status: "sent",
          slack_ts: ts,
          slack_channel_id: channel,
          error_code: null,
          error_message: null,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", row.id);

      const changeId = (p.meta as { changeId?: string })?.changeId;
      if (
        p.method === "chat.postMessage" &&
        changeId &&
        ts &&
        channel
      ) {
        await admin
          .from("change_events")
          .update({ slack_channel_id: channel, slack_message_ts: ts })
          .eq("id", changeId);
      }

      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempt = (row.attempt_count ?? 0) + 1;
      const retryable = isRetryable(msg);

      if (!retryable || attempt >= MAX_ATTEMPTS) {
        await admin
          .from("slack_message_deliveries")
          .update({
            status: "failed",
            error_message: msg.slice(0, 500),
            error_code: retryable ? "max_attempts_exceeded" : "permanent_failure",
            attempt_count: attempt,
            resolved_at: now,
            updated_at: now,
          })
          .eq("id", row.id);
        errors += 1;
      } else {
        await admin
          .from("slack_message_deliveries")
          .update({
            status: "retrying",
            error_message: msg.slice(0, 500),
            error_code: null,
            attempt_count: attempt,
            next_retry_at: nextRetryAt(attempt),
            updated_at: now,
          })
          .eq("id", row.id);
      }

      processed += 1;
      logError("slack.deliveries.process.send_failed", e instanceof Error ? e : new Error(msg), {
        deliveryId: row.id,
        messageType: row.message_type,
        attempt,
      });
    }
  }

  logInfo("slack.deliveries.process.completed", { processed, errors });

  return NextResponse.json({ ok: true, processed, errors });
}
