import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";
import { uuidParam } from "@/lib/server/apiSchemas";

const patchBodySchema = z
  .object({
    role_name: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    enabled: z.boolean().optional(),
    member_user_ids: z.array(z.string().uuid()).optional(),
  })
  .strict();

export async function PATCH(req: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await routeCtx.params;
    const idParse = uuidParam.safeParse(rawId);
    if (!idParse.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const authz = await resolveResourceInOrg({
      table: "approval_roles",
      resourceId: idParse.data,
      permission: "approval.mappings.manage",
    });

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const updates: Record<string, unknown> = {};
    if (body.role_name !== undefined) updates.role_name = body.role_name;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await authz.supabase
        .from("approval_roles")
        .update(updates)
        .eq("org_id", authz.orgId)
        .eq("id", idParse.data);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    if (body.member_user_ids !== undefined) {
      const memberIds = [...new Set(body.member_user_ids.filter(Boolean))];
      const { error: delErr } = await authz.supabase
        .from("approval_role_members")
        .delete()
        .eq("org_id", authz.orgId)
        .eq("role_id", idParse.data);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      if (memberIds.length > 0) {
        const inserts = memberIds.map((uid) => ({
          org_id: authz.orgId,
          role_id: idParse.data,
          user_id: uid,
        }));
        const { error: insErr } = await authz.supabase.from("approval_role_members").insert(inserts);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "approval_role",
      entityId: idParse.data,
      metadata: { fields: Object.keys(body) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function DELETE(_req: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await routeCtx.params;
    const idParse = uuidParam.safeParse(rawId);
    if (!idParse.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const authz = await resolveResourceInOrg({
      table: "approval_roles",
      resourceId: idParse.data,
      permission: "approval.mappings.manage",
    });

    const { error } = await authz.supabase
      .from("approval_roles")
      .delete()
      .eq("org_id", authz.orgId)
      .eq("id", idParse.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "approval_role",
      entityId: idParse.data,
      metadata: { deleted: true },
      required: true,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
