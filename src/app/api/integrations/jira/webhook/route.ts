import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapJiraStatusToRg } from "@/lib/jira/statusMapping";
import { IntegrationRetryService } from "@/modules/integrations";

export const dynamic = "force-dynamic";

/**
 * Jira Cloud webhook receiver.
 * Validates X-Atlassian-Webhook-Identifier header.
 * Processes jira:issue_updated to sync status.
 */
export async function POST(req: NextRequest) {
  const webhookId = req.headers.get("X-Atlassian-Webhook-Identifier");
  if (!webhookId) {
    return NextResponse.json({ error: "Missing webhook identifier" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = (payload as { webhookEvent?: string }).webhookEvent;
  const issue = (payload as { issue?: { id?: string; key?: string; fields?: { status?: { name?: string } } } }).issue;

  if (!event || !issue) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (event !== "jira:issue_updated" && event !== "jira:issue_deleted") {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("jira_issue_links")
    .select("org_id, change_event_id")
    .eq("jira_issue_id", String(issue.id))
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ received: true });
  }

  const orgId = (link as { org_id: string }).org_id;
  const changeEventId = (link as { change_event_id: string }).change_event_id;

  if (event === "jira:issue_deleted") {
    await admin
      .from("jira_issue_links")
      .delete()
      .eq("org_id", orgId)
      .eq("jira_issue_id", String(issue.id));
    return NextResponse.json({ received: true });
  }

  const jiraStatus = issue.fields?.status?.name;
  if (!jiraStatus) {
    return NextResponse.json({ received: true });
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
    return NextResponse.json({ received: true });
  }

  const { error } = await admin
    .from("change_events")
    .update({ status: rgStatus, updated_at: new Date().toISOString() })
    .eq("id", changeEventId)
    .eq("org_id", orgId);

  if (error) {
    const retrySvc = new IntegrationRetryService(admin);
    await retrySvc.recordRetryableFailure(
      "jira",
      orgId,
      event,
      payload as Record<string, unknown>,
      { entityType: "change_event", entityId: changeEventId },
      { message: error.message }
    );
    return NextResponse.json(
      { error: "Failed to update change status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
