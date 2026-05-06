import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSlackToSolvrenUserId, SLACK_NOT_LINKED_EPHEMERAL } from "@/lib/slack/resolveSlackUser";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import { permissionForIssueWorkflowAction } from "./issueActionPermission";
import { executeIssueWorkflowAction, type IssueWorkflowActionType } from "./executeIssueWorkflowAction";
import type { IssueWorkflowSlackJobPayload } from "@/lib/slack/approvalActions";

/** Re-export slackApi if needed — use local minimal slackApi for ephemeral after job */
async function slackApi(botToken: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json?.ok) throw new Error(json?.error ?? `Slack API error: ${method}`);
  return json;
}

export function parseIssueSlackButtonValue(raw: string | undefined): { orgId: string; issueId: string } | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as { orgId?: string; org_id?: string; issueId?: string; issue_id?: string };
    const orgId = String(p.orgId ?? p.org_id ?? "").trim();
    const issueId = String(p.issueId ?? p.issue_id ?? "").trim();
    if (!orgId || !issueId) return null;
    return { orgId, issueId };
  } catch {
    return null;
  }
}

export function slackActionIdToIssueAction(actionId: string): IssueWorkflowActionType | null {
  switch (actionId) {
    case "issue_acknowledge":
      return "acknowledge";
    case "issue_dismiss":
      return "dismiss";
    case "issue_approve":
      return "approve";
    case "issue_deny":
      return "deny";
    case "issue_request_changes":
      return "request_changes";
    case "issue_mark_in_progress":
      return "mark_in_progress";
    case "issue_resolve":
      return "resolve";
    case "issue_reopen":
      return "reopen";
    default:
      return null;
  }
}

/**
 * Background worker: maps Slack user → Solvren user, RBAC, then {@link executeIssueWorkflowAction}.
 */
export async function processIssueWorkflowSlackJob(
  admin: SupabaseClient,
  payload: IssueWorkflowSlackJobPayload
): Promise<{ ok: boolean; userMessage: string }> {
  const { orgId, issueId, subAction, slackUserId, teamId, channelId } = payload;

  const { data: install } = await admin
    .from("slack_installations")
    .select("bot_token")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const botToken = install?.bot_token as string | undefined;

  const solvrenUserId = await resolveSlackToSolvrenUserId({
    admin,
    orgId,
    slackTeamId: teamId,
    slackUserId,
    botToken: botToken ?? null,
  });

  if (!solvrenUserId) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: SLACK_NOT_LINKED_EPHEMERAL,
      });
    }
    return { ok: false, userMessage: "not_linked" };
  }

  const perm = permissionForIssueWorkflowAction(subAction);
  const allowed = await hasPermissionInOrg(admin, solvrenUserId, orgId, perm);
  if (!allowed) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: "You do not have permission for this action.",
      });
    }
    return { ok: false, userMessage: "forbidden" };
  }

  const { data: userRow } = await admin.auth.admin.getUserById(solvrenUserId);
  const email = userRow?.user?.email ?? null;

  const result = await executeIssueWorkflowAction(admin, {
    issueId,
    actorUserId: solvrenUserId,
    actorEmail: email,
    actorDisplayName: null,
    source: "slack",
    action: subAction,
    payload: {},
  });

  if (!result.ok) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: result.error.slice(0, 300),
      });
    }
    return { ok: false, userMessage: result.error };
  }

  if (botToken) {
    await slackApi(botToken, "chat.postEphemeral", {
      channel: channelId,
      user: slackUserId,
      text: `Updated issue (${subAction.replace(/_/g, " ")})`,
    });
  }

  return { ok: true, userMessage: "ok" };
}
