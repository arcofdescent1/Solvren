import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

type PatchBody = { role_label?: string; approval_area?: string };

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sessionCtx = await requireAnyOrgPermission("approval.mappings.manage");
    const supabase = sessionCtx.supabase;

    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { id } = await ctx.params;
    const orgId = sessionCtx.orgId;
    const admin = createPrivilegedClient("PATCH /api/admin/approval-role-map/[id]");

    const updates: Record<string, string> = {};
    if (body.role_label !== undefined) {
      const v = body.role_label.trim();
      if (!v) return NextResponse.json({ error: "role_label cannot be empty" }, { status: 400 });
      updates.role_label = v;
    }
    if (body.approval_area !== undefined) {
      const v = body.approval_area.trim();
      if (!v) return NextResponse.json({ error: "approval_area cannot be empty" }, { status: 400 });
      updates.approval_area = v;
    }
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const { data: row, error } = await admin
      .from("approval_role_map")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(supabase, {
      orgId,
      actorId: sessionCtx.user.id,
      action: "APPROVAL_ROLE_MAP_UPDATED",
      entityType: "approval_role_map",
      entityId: id,
      metadata: { row },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sessionCtx = await requireAnyOrgPermission("approval.mappings.manage");
    const supabase = sessionCtx.supabase;

    const { id } = await ctx.params;
    const orgId = sessionCtx.orgId;
    const admin = createPrivilegedClient("DELETE /api/admin/approval-role-map/[id]");

    const { data: before } = await admin
      .from("approval_role_map")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { error } = await admin.from("approval_role_map").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(supabase, {
      orgId,
      actorId: sessionCtx.user.id,
      action: "APPROVAL_ROLE_MAP_DELETED",
      entityType: "approval_role_map",
      entityId: id,
      metadata: { before },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
