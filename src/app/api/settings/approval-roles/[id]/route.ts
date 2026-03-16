import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

type PatchBody = {
  role_name?: string;
  description?: string | null;
  enabled?: boolean;
  member_user_ids?: string[];
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const orgId = auth.orgId;

  const updates: Record<string, unknown> = {};
  if (body.role_name !== undefined) {
    const v = body.role_name.trim();
    if (!v) return NextResponse.json({ error: "role_name cannot be empty" }, { status: 400 });
    updates.role_name = v;
  }
  if (body.description !== undefined) updates.description = body.description ?? null;
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await admin
      .from("approval_roles")
      .update(updates)
      .eq("org_id", orgId)
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (body.member_user_ids !== undefined) {
    const memberIds = [...new Set((body.member_user_ids ?? []).filter(Boolean))];
    const { error: delErr } = await admin
      .from("approval_role_members")
      .delete()
      .eq("org_id", orgId)
      .eq("role_id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (memberIds.length > 0) {
      const inserts = memberIds.map((uid) => ({
        org_id: orgId,
        role_id: id,
        user_id: uid,
      }));
      const { error: insErr } = await admin.from("approval_role_members").insert(inserts);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_role_updated",
    entityType: "approval_role",
    entityId: id,
    metadata: { fields: Object.keys(body) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const orgId = auth.orgId;

  const { error } = await admin
    .from("approval_roles")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_role_deleted",
    entityType: "approval_role",
    entityId: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
