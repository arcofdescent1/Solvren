import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyApprovalRoleSuggestions,
  resolveApprovalRoleSuggestions,
} from "@/services/approvals/roleMapping";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;
  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, change_type, structured_change_type, systems_involved")
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const resolved = await resolveApprovalRoleSuggestions(admin, {
    orgId: String(change.org_id),
    domain: String(change.domain ?? "REVENUE"),
    systems: Array.isArray(change.systems_involved) ? (change.systems_involved as string[]) : [],
    changeType: String(change.structured_change_type ?? change.change_type ?? "") || null,
  });

  const { inserted } = await applyApprovalRoleSuggestions(admin, {
    orgId: String(change.org_id),
    changeId,
    domain: String(change.domain ?? "REVENUE"),
    suggestions: resolved.suggestions,
  });

  if (resolved.suggestions.length > 0) {
    await addTimelineEvent({
      supabase,
      orgId: String(change.org_id),
      changeEventId: changeId,
      actorUserId: userRes.user.id,
      eventType: "APPROVERS_ASSIGNED",
      title: "Approver suggestions applied",
      description: `${inserted} approver(s) assigned from mapping rules`,
      metadata: {
        roles: resolved.suggestions.map((s) => s.roleName),
        inserted,
      },
    });
  }

  await auditLog(supabase, {
    orgId: String(change.org_id),
    actorId: userRes.user.id,
    action: "approval_mapping_suggestions_applied",
    entityType: "change",
    entityId: changeId,
    metadata: {
      inserted,
      roles: resolved.suggestions.map((s) => s.roleName),
      warnings: resolved.warnings,
    },
  });

  return NextResponse.json({
    ok: true,
    inserted,
    roles: resolved.suggestions.map((s) => s.roleName),
    warnings: resolved.warnings,
  });
}
