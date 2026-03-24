/**
 * Phase 3 — Slack post_message action handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slackPostMessage } from "@/lib/notify/slack";
import type { ActionExecutionResult } from "../../../contracts/runtime";

export async function executeSlackPostMessage(
  admin: SupabaseClient,
  input: {
    orgId: string;
    params: Record<string, unknown>;
  }
): Promise<ActionExecutionResult> {
  const channelId = input.params.channelId as string | undefined;
  const message = input.params.message as string | undefined;

  if (!channelId?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "channelId is required" };
  }
  if (!message?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "message is required" };
  }

  const { data: install } = await admin
    .from("slack_installations")
    .select("bot_token, status")
    .eq("org_id", input.orgId)
    .maybeSingle();

  const row = install as { bot_token?: string; status?: string } | null;
  if (!row || row.status !== "ACTIVE" || !row.bot_token) {
    return { success: false, errorCode: "NOT_FOUND", errorMessage: "Slack not connected" };
  }

  try {
    const res = (await slackPostMessage({
      botToken: row.bot_token,
      channel: channelId.trim(),
      text: message.trim(),
    })) as { ts?: string; channel?: string };

    const ts = res?.ts ?? "";
    const externalId = ts ? `${channelId}:${ts}` : "";
    return { success: true, externalId, message: "Message posted" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Slack API failed";
    const code = msg.includes("channel_not_found") || msg.includes("not_in_channel")
      ? "NOT_FOUND"
      : "PROVIDER_ERROR";
    return { success: false, errorCode: code, errorMessage: msg };
  }
}
