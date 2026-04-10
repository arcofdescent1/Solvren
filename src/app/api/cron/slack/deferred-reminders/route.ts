/**
 * Phase 4: Execute slack_deferred_actions (source: slack_deferred_actions).
 * Run every ~5 minutes with cron secret.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";
import { enqueueSlack } from "@/services/notifications/enqueueSlack";
import { deliverSlack } from "@/services/notifications/deliverSlack";
import { env } from "@/lib/env";

const MAX_BATCH = 40;

async function slackApi(botToken: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; channel?: { id?: string } };
  if (!json?.ok) throw new Error(json?.error ?? method);
  return json;
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("slack_deferred_actions")
    .select("id, org_id, user_id, change_event_id, approval_id, slack_channel_id, slack_message_ts")
    .is("sent_at", null)
    .lte("reminder_at", now)
    .order("reminder_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    logError("slack.deferred_reminders.fetch_failed", new Error(error.message));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  const baseUrl = env.appUrl.replace(/\/$/, "");

  for (const row of rows ?? []) {
    const id = row.id as string;
    const orgId = row.org_id as string;
    const changeId = row.change_event_id as string;
    const approvalId = row.approval_id as string;

    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    const botToken = install?.bot_token as string | undefined;

    const { data: map } = await admin
      .from("slack_user_map")
      .select("slack_user_id")
      .eq("org_id", orgId)
      .eq("user_id", row.user_id as string)
      .maybeSingle();
    const slackUserId = map?.slack_user_id as string | undefined;

    const { data: change } = await admin
      .from("change_events")
      .select("title")
      .eq("id", changeId)
      .maybeSingle();
    const title = (change as { title?: string } | null)?.title ?? "Change";
    const execUrl = `${baseUrl}/executive/changes/${changeId}?view=executive-lite`;
    const text = `⏰ *Reminder:* You deferred this approval — *${title}* is still waiting.\n<${execUrl}|Open executive overview>`;

    let delivered = false;

    if (botToken && row.slack_channel_id && row.slack_message_ts) {
      try {
        await deliverSlack({
          botToken,
          payload: {
            method: "chat.postMessage",
            args: {
              channel: row.slack_channel_id as string,
              thread_ts: row.slack_message_ts as string,
              text,
            },
          },
        });
        delivered = true;
      } catch {
        delivered = false;
      }
    }

    if (!delivered && botToken && slackUserId) {
      try {
        const open = (await slackApi(botToken, "conversations.open", {
          users: slackUserId,
        })) as { channel?: { id?: string } };
        const dm = open.channel?.id;
        if (dm) {
          await enqueueSlack(admin, {
            orgId,
            kind: "slack_deferred_reminder",
            dedupeKey: `slack_deferred_reminder:${id}:${Date.now()}`,
            method: "chat.postMessage",
            methodArgs: { channel: dm, text },
            changeEventId: changeId,
            meta: { approvalId },
          });
          delivered = true;
        }
      } catch (e) {
        logError(
          "slack.deferred_reminders.dm_failed",
          e instanceof Error ? e : new Error(String(e)),
          { id }
        );
      }
    }

    if (delivered || !botToken) {
      await admin.from("slack_deferred_actions").update({ sent_at: now }).eq("id", id);
      processed += 1;
    }
  }

  logInfo("slack.deferred_reminders.completed", { processed });
  return NextResponse.json({ ok: true, processed });
}
