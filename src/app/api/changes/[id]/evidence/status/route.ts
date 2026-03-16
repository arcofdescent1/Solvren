import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canViewChange } from "@/lib/access/changeAccess";

type Body = {
  evidenceId: string;
  status: "MISSING" | "PROVIDED" | "WAIVED";
  note?: string | null;
  url?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id: changeId } = await ctx.params;

  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const orgId = (change as { org_id?: string }).org_id as string;
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !canRole(parseOrgRole((member as { role?: string | null }).role ?? null), "change.evidence.provide")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = { status: body.status };
  if (body.status === "PROVIDED") {
    updatePayload.note = body.note ?? null;
    updatePayload.url = body.url ?? null;
    updatePayload.provided_at = new Date().toISOString();
    updatePayload.provided_by = userRes.user.id;
  } else if (body.status === "MISSING") {
    updatePayload.note = null;
    updatePayload.url = null;
    updatePayload.provided_at = null;
    updatePayload.provided_by = null;
  }

  const { data: updated, error } = await supabase
    .from("change_evidence_items")
    .update(updatePayload)
    .eq("id", body.evidenceId)
    .eq("change_event_id", changeId)
    .select("id, kind, label, status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const auditAction =
    body.status === "PROVIDED"
      ? "evidence_provided"
      : body.status === "WAIVED"
        ? "evidence_waived"
        : "evidence_status_updated";

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    action: auditAction,
    entityType: "change_event",
    entityId: changeId,
    metadata: { evidenceId: body.evidenceId, newStatus: body.status, item: updated },
  });

  if (body.status === "PROVIDED" && updated) {
    await addTimelineEvent({
      supabase,
      orgId,
      changeEventId: changeId,
      actorUserId: userRes.user.id,
      eventType: "EVIDENCE_PROVIDED",
      title: "Evidence provided",
      description: `${updated.label || updated.kind} – provided`,
      metadata: { evidence_kind: updated.kind, label: updated.label },
    });
  } else if (body.status === "WAIVED" && updated) {
    await addTimelineEvent({
      supabase,
      orgId,
      changeEventId: changeId,
      actorUserId: userRes.user.id,
      eventType: "EVIDENCE_WAIVED",
      title: "Evidence waived",
      description: `${updated.label || updated.kind} – waived`,
      metadata: { evidence_kind: updated.kind, label: updated.label },
    });
  }

  return NextResponse.json({ ok: true, item: updated });
}
