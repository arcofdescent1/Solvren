/**
 * Phase 3 — Jira create_issue action handler.
 * Creates a Jira issue from Solvren issue context and links it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureValidJiraToken } from "@/services/jira/jiraAuthService";
import { jiraPost } from "@/lib/jira/client";
import { getIssueContext } from "../../../actions/issueContextService";
import type { ActionExecutionResult } from "../../../contracts/runtime";

export type CreateIssueParams = {
  projectKey: string;
  summary: string;
  issueType?: string;
};

export async function executeJiraCreateIssue(
  admin: SupabaseClient,
  input: {
    orgId: string;
    issueId: string | null;
    params: Record<string, unknown>;
  }
): Promise<ActionExecutionResult> {
  const projectKey = input.params.projectKey as string | undefined;
  const summary = input.params.summary as string | undefined;
  const issueType = (input.params.issueType as string | undefined) ?? "Task";

  if (!projectKey?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "projectKey is required" };
  }
  if (!summary?.trim()) {
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: "summary is required" };
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", input.orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = conn as { status?: string; config?: { cloudId?: string } } | null;
  const cloudId = c?.config?.cloudId;
  const connected = c?.status === "connected" || c?.status === "configured";
  if (!connected || !cloudId) {
    return { success: false, errorCode: "NOT_FOUND", errorMessage: "Jira not connected or missing cloudId" };
  }

  const creds = await ensureValidJiraToken(admin, input.orgId);
  if (!creds) {
    return { success: false, errorCode: "AUTH_ERROR", errorMessage: "No valid Jira credentials" };
  }

  let description = summary;
  if (input.issueId) {
    const ctx = await getIssueContext(admin, input.issueId);
    if (ctx) {
      const parts: string[] = [
        ctx.summary || ctx.title,
        "",
        `Severity: ${ctx.severity}`,
        ctx.revenueAtRisk > 0 ? `Revenue at Risk: $${ctx.revenueAtRisk.toLocaleString()}` : "",
        ctx.description || "",
      ].filter(Boolean);
      description = parts.join("\n");
    }
  }

  const body = {
    fields: {
      project: { key: projectKey.trim() },
      summary: summary.trim(),
      issuetype: { name: issueType },
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
    },
  };

  let created: { id?: string; key?: string };
  try {
    created = await jiraPost<{ id: string; key: string }>(cloudId, creds.accessToken, "/issue", body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Jira API failed";
    const code = msg.includes("401") || msg.includes("403") ? "AUTH_ERROR" : msg.includes("404") ? "NOT_FOUND" : "PROVIDER_ERROR";
    return { success: false, errorCode: code, errorMessage: msg };
  }

  const jiraKey = created.key ?? created.id ?? "";
  if (!jiraKey) {
    return { success: false, errorCode: "PROVIDER_ERROR", errorMessage: "Jira did not return issue key" };
  }

  if (input.issueId) {
    const jiraId = created.id ?? jiraKey;
    await admin.from("issue_jira_links").insert({
      org_id: input.orgId,
      issue_id: input.issueId,
      jira_issue_key: jiraKey,
      jira_issue_id: jiraId,
      jira_project_key: projectKey.trim(),
    });
  }

  return { success: true, externalId: jiraKey, message: `Created ${jiraKey}` };
}
