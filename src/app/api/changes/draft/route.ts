import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApprovalRoleSuggestions } from "@/services/approvals/roleMapping";
import { auditLog } from "@/lib/audit";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";

type Body = { orgId: string; title?: string };

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.orgId)
    return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", body.orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  if (!canRole(parseOrgRole((member as { role?: string | null }).role ?? null), "change.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = (body.title?.trim() || "Untitled change").slice(0, 500);

  const { data: change, error } = await supabase
    .from("change_events")
    .insert({
      org_id: body.orgId,
      title,
      change_type: "OTHER",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: [],
      revenue_impact_areas: [],
      intake: {},
      created_by: userRes.user.id,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!change)
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 }
    );

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

  await addTimelineEvent({
    supabase,
    orgId: body.orgId,
    changeEventId: change.id,
    actorUserId: userRes.user.id,
    eventType: "CHANGE_CREATED",
    title: "Change created",
    description: `${userRes.user.email ?? "User"} created the change`,
    metadata: { title },
  });

  try {
    const admin = createAdminClient();
    const resolved = await resolveApprovalRoleSuggestions(admin, {
      orgId: body.orgId,
      domain: "REVENUE",
      systems: [],
      changeType: "OTHER",
    });
    await auditLog(supabase, {
      orgId: body.orgId,
      actorId: userRes.user.id,
      action: "approval_mapping_evaluated",
      entityType: "change",
      entityId: change.id,
      metadata: {
        suggested_roles: resolved.suggestions.map((s) => s.roleName),
        suggested_users: resolved.suggestedUserIds.length,
        warnings: resolved.warnings,
      },
    });
  } catch {
    // best effort
  }

  return NextResponse.json({
    ok: true,
    changeId: change.id,
  });
}
