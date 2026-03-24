import { NextResponse } from "next/server";
import { z } from "zod";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { resolveApprovalRoleSuggestions } from "@/services/approvals/roleMapping";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  title: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { orgId: orgIdRaw, title: titleRaw } = parsed.data;
    const orgId = parseRequestedOrgId(orgIdRaw);

    const ctx = await requireOrgPermission(orgId, "change.create");
    const supabase = ctx.supabase;

    const title = (titleRaw?.trim() || "Untitled change").slice(0, 500);

    const { data: change, error } = await supabase
      .from("change_events")
      .insert({
        org_id: orgId,
        title,
        change_type: "OTHER",
        status: "DRAFT",
        domain: "REVENUE",
        systems_involved: [],
        revenue_impact_areas: [],
        intake: {},
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!change) return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });

    const { error: iaErr } = await supabase.from("impact_assessments").insert({
      change_event_id: change.id,
      domain: "REVENUE",
      status: "PENDING",
      schema_version: "pass_a_v1",
    });
    if (iaErr) {
      return NextResponse.json({ error: iaErr.message ?? "Failed to create assessment" }, { status: 500 });
    }

    await addTimelineEvent({
      supabase,
      orgId,
      changeEventId: change.id,
      actorUserId: ctx.user.id,
      eventType: "CHANGE_CREATED",
      title: "Change created",
      description: `${ctx.user.email ?? "User"} created the change`,
      metadata: { title },
    });

    try {
      const admin = createPrivilegedClient("POST /api/changes/draft: resolveApprovalRoleSuggestions");
      const resolved = await resolveApprovalRoleSuggestions(admin, {
        orgId,
        domain: "REVENUE",
        systems: [],
        changeType: "OTHER",
      });
      await auditLog(admin, {
        orgId,
        actorId: ctx.user.id,
        actorType: "USER",
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
