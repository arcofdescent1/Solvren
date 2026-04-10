/**
 * Phase 4 v1: Daily Slack DM digest (pending / escalated / followed / stale high-risk).
 * Org flag: organization_settings.slack_digest_daily_enabled
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { logInfo } from "@/lib/observability/logger";
import { enqueueSlack } from "@/services/notifications/enqueueSlack";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const baseUrl = env.appUrl.replace(/\/$/, "");

  const { data: orgs } = await admin
    .from("organization_settings")
    .select("org_id")
    .eq("slack_digest_daily_enabled", true);

  let queued = 0;
  for (const row of orgs ?? []) {
    const orgId = (row as { org_id?: string }).org_id as string;
    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!install?.bot_token) continue;

    const { data: maps } = await admin
      .from("slack_user_map")
      .select("user_id, slack_user_id")
      .eq("org_id", orgId);

    for (const m of maps ?? []) {
      const userId = (m as { user_id?: string }).user_id as string;
      const slackUserId = (m as { slack_user_id?: string }).slack_user_id as string;

      const { data: pending } = await admin
        .from("approvals")
        .select("id, change_event_id")
        .eq("org_id", orgId)
        .eq("approver_user_id", userId)
        .eq("decision", "PENDING")
        .limit(12);

      const lines: string[] = [];
      if ((pending ?? []).length > 0) {
        lines.push(`*Pending approvals:* ${(pending ?? []).length}`);
        for (const p of (pending ?? []).slice(0, 5)) {
          const cid = (p as { change_event_id?: string }).change_event_id as string;
          lines.push(`• <${baseUrl}/executive/changes/${cid}?view=executive-lite|Change ${cid.slice(0, 8)}…>`);
        }
      }

      const { data: follows } = await admin
        .from("change_followers")
        .select("change_event_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .limit(5);
      if ((follows ?? []).length > 0) {
        lines.push(`*Followed changes:* ${(follows ?? []).length}`);
      }

      if (lines.length === 0) continue;

      const text = `📋 *Your Solvren digest*\n\n${lines.join("\n")}`;
      const openRes = await fetch("https://slack.com/api/conversations.open", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${install.bot_token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ users: slackUserId }),
      });
      const openJson = (await openRes.json()) as {
        ok?: boolean;
        channel?: { id?: string };
      };
      const dm = openJson.channel?.id;
      if (!dm) continue;

      await enqueueSlack(admin, {
        orgId,
        kind: "slack_daily_digest",
        dedupeKey: `slack_daily_digest:${orgId}:${userId}:${new Date().toISOString().slice(0, 10)}`,
        method: "chat.postMessage",
        methodArgs: { channel: dm, text },
      });
      queued += 1;
    }
  }

  logInfo("slack.daily_digest.completed", { queued });
  return NextResponse.json({ ok: true, queued });
}
