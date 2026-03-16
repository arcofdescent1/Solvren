/**
 * Jira webhook registration via REST API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { ensureValidJiraToken } from "./jiraAuthService";
import { jiraPost, jiraDelete } from "@/lib/jira/client";

function getWebhookUrl(): string {
  try {
    const base = (env.appUrl ?? "").replace(/\/$/, "");
    return base ? `${base}/api/integrations/jira/webhook` : "";
  } catch {
    return (process.env.APP_URL ?? "").replace(/\/$/, "") + "/api/integrations/jira/webhook";
  }
}

export async function registerJiraWebhooks(
  admin: SupabaseClient,
  orgId: string,
  connId: string,
  cloudId: string,
  projects: string[]
): Promise<{ webhookId?: string; error?: string }> {
  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) return { error: "No valid Jira credentials" };

  const url = getWebhookUrl();
  if (!url) return { error: "APP_URL not configured" };

  const jqlFilter =
    projects.length > 0 ? `project in (${projects.join(", ")})` : undefined;

  const body = {
    url,
    webhooks: [
      {
        events: ["jira:issue_updated", "jira:issue_deleted", "comment_created"],
        ...(jqlFilter && { jqlFilter }),
      },
    ],
  };

  try {
    const res = (await jiraPost<{ webhookRegistrationResult?: { createdWebhookId?: number; errors?: string[] }[] }>(
      cloudId,
      creds.accessToken,
      "/webhook",
      body
    )) as { webhookRegistrationResult?: { createdWebhookId?: number; errors?: string[] }[] };
    const result = res?.webhookRegistrationResult?.[0];
    if (result?.errors?.length) {
      return { error: result.errors.join("; ") };
    }
    const webhookId = result?.createdWebhookId ? String(result.createdWebhookId) : undefined;
    if (webhookId) {
      await admin
        .from("jira_webhook_registrations")
        .delete()
        .eq("org_id", orgId)
        .eq("integration_connection_id", connId);
      await admin.from("jira_webhook_registrations").insert({
        org_id: orgId,
        integration_connection_id: connId,
        jira_webhook_id: webhookId,
        cloud_id: cloudId,
        callback_url: url,
        events: body.webhooks[0].events,
        jql_filter: jqlFilter ?? null,
        status: "active",
        last_verified_at: new Date().toISOString(),
      });
    }
    return { webhookId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function unregisterJiraWebhook(
  admin: SupabaseClient,
  orgId: string,
  webhookId: string,
  cloudId: string
): Promise<void> {
  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) return;

  await jiraDelete(cloudId, creds.accessToken, `/webhook?webhookIds=${webhookId}`);
  await admin
    .from("jira_webhook_registrations")
    .delete()
    .eq("org_id", orgId)
    .eq("jira_webhook_id", webhookId);
}
