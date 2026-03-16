import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

type PatchBody = {
  trigger_type?: "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";
  trigger_value?: string;
  approval_role_id?: string;
  priority?: number;
  enabled?: boolean;
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

  const updates: Record<string, unknown> = {};
  if (body.trigger_type !== undefined) {
    if (!["DOMAIN", "SYSTEM", "CHANGE_TYPE"].includes(body.trigger_type)) {
      return NextResponse.json({ error: "Invalid trigger_type" }, { status: 400 });
    }
    updates.trigger_type = body.trigger_type;
  }
  if (body.trigger_value !== undefined) {
    const v = body.trigger_value.trim();
    if (!v) return NextResponse.json({ error: "trigger_value cannot be empty" }, { status: 400 });
    updates.trigger_value = v;
  }
  if (body.approval_role_id !== undefined) {
    updates.approval_role_id = body.approval_role_id;
  }
  if (body.priority !== undefined) updates.priority = Number(body.priority);
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const orgId = auth.orgId;

  if (updates.approval_role_id) {
    const { data: role } = await admin
      .from("approval_roles")
      .select("id")
      .eq("org_id", orgId)
      .eq("id", String(updates.approval_role_id))
      .maybeSingle();
    if (!role) return NextResponse.json({ error: "Role not found in org" }, { status: 400 });
  }

  const { error } = await admin
    .from("approval_mappings")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_mapping_updated",
    entityType: "approval_mapping",
    entityId: id,
    metadata: { fields: Object.keys(updates) },
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
    .from("approval_mappings")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_mapping_deleted",
    entityType: "approval_mapping",
    entityId: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
