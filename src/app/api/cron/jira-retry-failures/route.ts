import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { env } from "@/lib/env";
import { mapJiraStatusToRg } from "@/lib/jira/statusMapping";
import { DEFAULT_MAX_ATTEMPTS, nextRetryAt } from "@/lib/integrations/retry";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  if (!env.jiraEnabled) {
    return NextResponse.json({ ok: true, message: "Jira disabled" });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: failures } = await admin
    .from("integration_event_failures")
    .select("id, org_id, event_type, payload, attempts, max_attempts")
    .eq("provider", "jira")
    .lte("next_retry_at", now)
    .limit(20);

  let resolved = 0;
  let retrying = 0;

  for (const f of failures ?? []) {
    const attemptCount = (f.attempts ?? 0) + 1;
    const maxAttempts = f.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
    const payload = f.payload as { issue?: { id?: string; fields?: { status?: { name?: string } } } };
    const issue = payload?.issue;
    const eventType = f.event_type as string;

    if (attemptCount > maxAttempts) {
      await admin
        .from("integration_event_failures")
        .update({
          status: "failed_permanent",
          resolved_at: now,
          attempts: attemptCount,
          updated_at: now,
        })
        .eq("id", f.id);
      continue;
    }

    const { data: link } = await admin
      .from("jira_issue_links")
      .select("org_id, change_event_id")
      .eq("jira_issue_id", String(issue?.id ?? ""))
      .maybeSingle();

    if (!link) {
      await admin
        .from("integration_event_failures")
        .update({
          status: "failed_permanent",
          resolved_at: now,
          error_message: "No linked change found",
          updated_at: now,
        })
        .eq("id", f.id);
      continue;
    }

    const orgId = (link as { org_id: string }).org_id;
    const changeEventId = (link as { change_event_id: string }).change_event_id;

    if (eventType === "jira:issue_updated") {
      const jiraStatus = issue?.fields?.status?.name;
      if (!jiraStatus) {
        await admin
          .from("integration_event_failures")
          .update({
            status: "failed_permanent",
            resolved_at: now,
            error_message: "Missing status in payload",
            updated_at: now,
          })
          .eq("id", f.id);
        continue;
      }

      const { data: mappings } = await admin
        .from("jira_status_mappings")
        .select("jira_status, rg_status")
        .eq("org_id", orgId);
      const rgStatus = mapJiraStatusToRg(
        jiraStatus,
        (mappings as { jira_status: string; rg_status: string }[]) ?? []
      );

      if (!rgStatus) {
        await admin
          .from("integration_event_failures")
          .update({
            next_retry_at: nextRetryAt(attemptCount),
            attempts: attemptCount,
            status: "retrying",
            updated_at: now,
          })
          .eq("id", f.id);
        retrying++;
        continue;
      }

      const { error } = await admin
        .from("change_events")
        .update({ status: rgStatus, updated_at: now })
        .eq("id", changeEventId)
        .eq("org_id", orgId);

      if (error) {
        await admin
          .from("integration_event_failures")
          .update({
            next_retry_at: nextRetryAt(attemptCount),
            attempts: attemptCount,
            error_message: error.message,
            status: "retrying",
            updated_at: now,
          })
          .eq("id", f.id);
        retrying++;
      } else {
        await admin
          .from("integration_event_failures")
          .update({
            status: "resolved",
            resolved_at: now,
            attempts: attemptCount,
            error_message: null,
            updated_at: now,
          })
          .eq("id", f.id);
        resolved++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: (failures ?? []).length,
    resolved,
    retrying,
  });
}
