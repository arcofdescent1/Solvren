import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { auditLog } from "@/lib/audit";
import { enqueueJiraIssuePropertySync, enqueueJiraCommentSync } from "@/services/jira/jiraSyncService";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";

type Body = {
  orgId: string;
  jiraIssueId: string;
  jiraIssueKey: string;
  jiraProjectKey: string;
  summary: string;
  description?: string;
  assignee?: string;
  labels?: string[];
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orgId, jiraIssueId, jiraIssueKey, jiraProjectKey, summary } = body;
  if (!orgId || !jiraIssueId || !jiraIssueKey || !jiraProjectKey || !summary) {
    return NextResponse.json(
      { error: "orgId, jiraIssueId, jiraIssueKey, jiraProjectKey, summary required" },
      { status: 400 }
    );
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  if (!canRole(parseOrgRole((member as { role?: string }).role ?? null), "change.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("id, status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  if (!conn || (conn as { status?: string }).status !== "connected") {
    return NextResponse.json(
      { error: "Jira not connected for this organization" },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from("jira_issue_links")
    .select("change_event_id")
    .eq("org_id", orgId)
    .eq("jira_issue_id", jiraIssueId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      changeId: (existing as { change_event_id: string }).change_event_id,
      status: "already_linked",
    });
  }

  const title = summary.slice(0, 500) || "Untitled change";
  const intake = {
    jira: {
      jiraIssueId,
      jiraIssueKey,
      jiraProjectKey,
      assignee: body.assignee,
      labels: body.labels ?? [],
      description: body.description,
    },
  };

  const { data: change, error: changeErr } = await supabase
    .from("change_events")
    .insert({
      org_id: orgId,
      title,
      change_type: "OTHER",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: [],
      revenue_impact_areas: [],
      intake,
      created_by: userRes.user.id,
    })
    .select("id")
    .single();

  if (changeErr || !change) {
    return NextResponse.json(
      { error: changeErr?.message ?? "Failed to create change" },
      { status: 500 }
    );
  }

  const { error: iaErr } = await supabase.from("impact_assessments").insert({
    change_event_id: change.id,
    domain: "REVENUE",
    status: "PENDING",
    schema_version: "pass_a_v1",
  });

  if (iaErr) {
    return NextResponse.json(
      { error: iaErr.message ?? "Failed to create assessment" },
      { status: 500 }
    );
  }

  const { error: linkErr } = await admin.from("jira_issue_links").insert({
    org_id: orgId,
    change_event_id: change.id,
    jira_issue_id: jiraIssueId,
    jira_issue_key: jiraIssueKey,
    jira_project_key: jiraProjectKey,
  });

  if (linkErr) {
    return NextResponse.json(
      { error: linkErr.message ?? "Failed to link Jira issue" },
      { status: 500 }
    );
  }

  await addTimelineEvent({
    supabase,
    orgId,
    changeEventId: change.id,
    actorUserId: userRes.user.id,
    eventType: "CHANGE_CREATED",
    title: "Change created from Jira",
    description: `Linked from Jira issue ${jiraIssueKey}`,
    metadata: { jiraIssueKey },
  });

  await auditLog(supabase, {
    orgId,
    changeEventId: change.id,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "jira_change_created",
    entityType: "change",
    entityId: change.id,
    metadata: { jiraIssueId, jiraIssueKey },
  });

  await enqueueJiraIssuePropertySync(admin, orgId, change.id, {});
  await enqueueJiraCommentSync(admin, orgId, change.id, "change_created", {
    jiraIssueKey,
  });

  return NextResponse.json({
    changeId: change.id,
    status: "created",
  });
}
