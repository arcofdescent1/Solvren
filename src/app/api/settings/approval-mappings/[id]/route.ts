import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";
import { uuidParam } from "@/lib/server/apiSchemas";

const patchBodySchema = z
  .object({
    trigger_type: z.enum(["DOMAIN", "SYSTEM", "CHANGE_TYPE"]).optional(),
    trigger_value: z.string().trim().min(1).max(2000).optional(),
    approval_role_id: z.string().uuid().optional(),
    priority: z.number().int().min(0).max(1_000_000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await routeCtx.params;
    const idParse = uuidParam.safeParse(rawId);
    if (!idParse.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const authz = await resolveResourceInOrg({
      table: "approval_mappings",
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
    if (body.trigger_type !== undefined) updates.trigger_type = body.trigger_type;
    if (body.trigger_value !== undefined) updates.trigger_value = body.trigger_value;
    if (body.approval_role_id !== undefined) updates.approval_role_id = body.approval_role_id;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    if (updates.approval_role_id) {
      const { data: role } = await authz.supabase
        .from("approval_roles")
        .select("id")
        .eq("org_id", authz.orgId)
        .eq("id", String(updates.approval_role_id))
        .maybeSingle();
      if (!role) return NextResponse.json({ error: "Role not found in org" }, { status: 400 });
    }

    const { error } = await authz.supabase
      .from("approval_mappings")
      .update(updates)
      .eq("org_id", authz.orgId)
      .eq("id", idParse.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "approval_mapping",
      entityId: idParse.data,
      metadata: { fields: Object.keys(updates) },
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
      table: "approval_mappings",
      resourceId: idParse.data,
      permission: "approval.mappings.manage",
    });

    const { error } = await authz.supabase
      .from("approval_mappings")
      .delete()
      .eq("org_id", authz.orgId)
      .eq("id", idParse.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "approval_mapping",
      entityId: idParse.data,
      metadata: { deleted: true },
      required: true,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
