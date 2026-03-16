import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { env } from "@/lib/env";
import { syncJiraIssueProperty } from "@/services/jira/jiraIssuePropertyService";
import { syncJiraComment } from "@/services/jira/jiraCommentSyncService";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  if (!env.jiraEnabled) {
    return NextResponse.json({ ok: true, message: "Jira disabled" });
  }

  const admin = createAdminClient();

  const { data: jobs } = await admin
    .from("jira_sync_queue")
    .select("id, org_id, change_event_id, sync_type, event_type, payload")
    .is("processed_at", null)
    .limit(50);

  for (const job of jobs ?? []) {
    try {
      const { data: link } = await admin
        .from("jira_issue_links")
        .select("jira_issue_id")
        .eq("org_id", job.org_id)
        .eq("change_event_id", job.change_event_id)
        .maybeSingle();

      if (!link) {
        await admin
          .from("jira_sync_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }

      const jiraIssueId = (link as { jira_issue_id: string }).jira_issue_id;

      if (job.sync_type === "issue_property") {
        await syncJiraIssueProperty(job.org_id, job.change_event_id, jiraIssueId);
      } else if (job.sync_type === "comment") {
        const payload = (job.payload as Record<string, unknown>) ?? {};
        const eventType = (job.event_type ?? "governance_update") as string;
        const idempotencyKey = `jira_comment:${job.change_event_id}:${eventType}:${JSON.stringify(payload).slice(0, 100)}`;
        await syncJiraComment(
          job.org_id,
          job.change_event_id,
          jiraIssueId,
          eventType,
          { ...payload, changeEventId: job.change_event_id },
          idempotencyKey
        );
      }

      await admin
        .from("jira_sync_queue")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("jira_sync_queue")
        .update({
          error_message: msg,
          processed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return NextResponse.json({ ok: true, processed: (jobs ?? []).length });
}
