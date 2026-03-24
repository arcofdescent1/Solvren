/**
 * Phase 3 — Slack post_issue_summary action handler.
 * Fetches issue context, formats, and posts to channel.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slackPostMessage } from "@/lib/notify/slack";
import { getIssueContext, formatIssueSummaryForSlack } from "../../../actions/issueContextService";
import type { ActionExecutionResult } from "../../../contracts/runtime";

export async function executeSlackPostIssueSummary(
  admin: SupabaseClient,
  input: {
    orgId: string;
    issueId: string | null;
    params: Record<string, unknown>;
  }
): Promise<ActionExecutionResult> {
  const channelId = input.params.channelId as string | undefined;

  if (!channelId?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "channelId is required" };
  }
  if (!input.issueId) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "issueId is required for post_issue_summary" };
  }

  const ctx = await getIssueContext(admin, input.issueId);
  if (!ctx) {
    return { success: false, errorCode: "NOT_FOUND", errorMessage: "Issue not found" };
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

  const text = formatIssueSummaryForSlack(ctx);

  try {
    const res = (await slackPostMessage({
      botToken: row.bot_token,
      channel: channelId.trim(),
      text,
    })) as { ts?: string; channel?: string };

    const ts = res?.ts ?? "";
    const externalId = ts ? `${channelId}:${ts}` : "";
    return { success: true, externalId, message: "Issue summary posted" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Slack API failed";
    const code = msg.includes("channel_not_found") || msg.includes("not_in_channel")
      ? "NOT_FOUND"
      : "PROVIDER_ERROR";
    return { success: false, errorCode: code, errorMessage: msg };
  }
}
