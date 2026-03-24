import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";
import { revenuePolicyPatchSchema, uuidParam } from "@/lib/server/apiSchemas";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await ctx.params;
    const idParse = uuidParam.safeParse(rawId);
    if (!idParse.success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const authz = await resolveResourceInOrg({
      table: "revenue_policies",
      resourceId: idParse.data,
      permission: "policy.manage",
    });
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = revenuePolicyPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.rule_type !== undefined) updates.rule_type = body.rule_type;
    if (body.rule_config !== undefined) updates.rule_config = body.rule_config;
    if (body.systems_affected !== undefined) updates.systems_affected = body.systems_affected;
    if (body.enforcement_mode !== undefined) updates.enforcement_mode = body.enforcement_mode;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (Object.keys(updates).length === 0) {
      const { data } = await authz.supabase
        .from("revenue_policies")
        .select("*")
        .eq("id", idParse.data)
        .eq("org_id", authz.orgId)
        .single();
      return NextResponse.json({ ok: true, policy: data });
    }
    const { data, error } = await authz.supabase
      .from("revenue_policies")
      .update(updates)
      .eq("id", idParse.data)
      .eq("org_id", authz.orgId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "revenue_policy",
      entityId: idParse.data,
      metadata: { patch_keys: Object.keys(updates) },
    });
    return NextResponse.json({ ok: true, policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await ctx.params;
    const idParse = uuidParam.safeParse(rawId);
    if (!idParse.success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const authz = await resolveResourceInOrg({
      table: "revenue_policies",
      resourceId: idParse.data,
      permission: "policy.manage",
    });
    const { error } = await authz.supabase
      .from("revenue_policies")
      .delete()
      .eq("id", idParse.data)
      .eq("org_id", authz.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await auditLog(authz.supabase, {
      orgId: authz.orgId,
      actorId: authz.user.id,
      action: "org.settings.updated",
      entityType: "revenue_policy",
      entityId: idParse.data,
      metadata: { deleted: true },
      required: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
