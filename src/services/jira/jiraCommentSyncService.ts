/**
 * Sync Solvren governance events to Jira comments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureValidJiraToken } from "./jiraAuthService";
import { jiraPost } from "@/lib/jira/client";
import { buildChangeUrl } from "./jiraSyncService";

const COMMENT_PREFIX = "[Solvren]";

function formatComment(eventType: string, payload: Record<string, unknown>): string {
  const url = buildChangeUrl(String(payload.changeEventId ?? ""));
  const lines: string[] = [`${COMMENT_PREFIX} `];

  switch (eventType) {
    case "change_created":
      lines[0] += `Change created from Jira: RG-${String(payload.changeEventId ?? "").slice(0, 8)}.`;
      break;
    case "approval_requested":
      lines[0] += `Approval requested${payload.roles ? ` from ${payload.roles}` : ""} for change RG-${String(payload.changeEventId ?? "").slice(0, 8)}.`;
      break;
    case "approval_completed":
      lines[0] += `Approval completed for change RG-${String(payload.changeEventId ?? "").slice(0, 8)}.`;
      break;
    case "approval_rejected":
      lines[0] += `Change RG-${String(payload.changeEventId ?? "").slice(0, 8)} requires updates.${payload.reason ? ` Reason: ${payload.reason}` : ""}`;
      break;
    case "risk_completed":
      lines[0] += `Risk analysis completed for change RG-${String(payload.changeEventId ?? "").slice(0, 8)}.`;
      break;
    case "change_approved":
      lines[0] += `Change RG-${String(payload.changeEventId ?? "").slice(0, 8)} approved.`;
      break;
    case "change_blocked":
      lines[0] += `Change RG-${String(payload.changeEventId ?? "").slice(0, 8)} blocked: ${payload.reason ?? "Missing evidence"}.`;
      break;
    default:
      lines[0] += `Governance update for change RG-${String(payload.changeEventId ?? "").slice(0, 8)}.`;
  }

  lines.push(`Open change: ${url}`);
  return lines.join("\n");
}

export async function syncJiraComment(
  orgId: string,
  changeEventId: string,
  jiraIssueId: string,
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string
): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("jira_comment_syncs")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if ((existing as { status?: string } | null)?.status === "sent") {
    return;
  }

  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) throw new Error("No valid Jira credentials");

  const { data: conn } = await admin
    .from("integration_connections")
    .select("config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const config = (conn as { config?: { cloudId?: string; features?: { commentSync?: boolean } } } | null)?.config;
  if (!config?.features?.commentSync) return;

  const cloudId = config.cloudId;
  if (!cloudId) throw new Error("Missing cloudId");

  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: formatComment(eventType, { ...payload, changeEventId }) }],
        },
      ],
    },
  };

  const res = (await jiraPost<{ id?: string }>(
    cloudId,
    creds.accessToken,
    `/issue/${jiraIssueId}/comment`,
    body
  )) as { id?: string };

  await admin.from("jira_comment_syncs").upsert(
    {
      org_id: orgId,
      change_event_id: changeEventId,
      jira_issue_id: jiraIssueId,
      event_type: eventType,
      idempotency_key: idempotencyKey,
      jira_comment_id: res?.id ?? null,
      status: "sent",
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "idempotency_key" }
  );
}
