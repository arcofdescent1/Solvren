/**
 * Jira sync: issue property + comment sync.
 * Enqueues jobs; cron processes them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

function getAppBase(): string {
  try {
    return (env.appUrl ?? "").replace(/\/$/, "");
  } catch {
    return process.env.APP_URL?.replace(/\/$/, "") ?? "";
  }
}

export type SyncJob = {
  syncType: "issue_property" | "comment";
  eventType?: string;
  payload?: Record<string, unknown>;
};

/**
 * Enqueue Jira issue property sync for a change.
 */
export async function enqueueJiraIssuePropertySync(
  admin: SupabaseClient,
  orgId: string,
  changeEventId: string,
  payload?: Record<string, unknown>
) {
  if (!env.jiraEnabled) return;

  await admin.from("jira_sync_queue").insert({
    org_id: orgId,
    change_event_id: changeEventId,
    sync_type: "issue_property",
    payload: payload ?? {},
  });
}

/**
 * Enqueue Jira comment sync for a change.
 */
export async function enqueueJiraCommentSync(
  admin: SupabaseClient,
  orgId: string,
  changeEventId: string,
  eventType: string,
  payload?: Record<string, unknown>
) {
  if (!env.jiraEnabled) return;

  await admin.from("jira_sync_queue").insert({
    org_id: orgId,
    change_event_id: changeEventId,
    sync_type: "comment",
    event_type: eventType,
    payload: payload ?? {},
  });
}

export function buildChangeUrl(changeEventId: string): string {
  return `${getAppBase()}/changes/${changeEventId}`;
}
