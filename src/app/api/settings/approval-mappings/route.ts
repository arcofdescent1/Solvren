import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";

function isTableMissingError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("not found"))
  );
}

const createBodySchema = z.object({
  trigger_type: z.enum(["DOMAIN", "SYSTEM", "CHANGE_TYPE"]),
  trigger_value: z.string().trim().min(1).max(2000),
  approval_role_id: z.string().uuid(),
  priority: z.number().int().min(0).max(1_000_000).optional(),
  enabled: z.boolean().optional(),
});

async function mappingsCtx() {
  const def = await resolveDefaultOrgForUser();
  return requireOrgPermission(def.orgId, "approval.mappings.manage");
}

export async function GET() {
  try {
    const ctx = await mappingsCtx();
    const { data, error } = await ctx.supabase
      .from("approval_mappings")
      .select(
        "id, trigger_type, trigger_value, approval_role_id, priority, enabled, created_at, updated_at, approval_roles!inner(id, role_name)"
      )
      .eq("org_id", ctx.orgId)
      .order("priority", { ascending: false })
      .order("trigger_type", { ascending: true })
      .order("trigger_value", { ascending: true });
    if (error) {
      if (isTableMissingError(error)) return NextResponse.json({ ok: true, rows: [] });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []).map((r) => ({
      id: r.id,
      trigger_type: r.trigger_type,
      trigger_value: r.trigger_value,
      approval_role_id: r.approval_role_id,
      priority: r.priority,
      enabled: r.enabled,
      created_at: r.created_at,
      updated_at: r.updated_at,
      role_name: (r as { approval_roles?: { role_name?: string } }).approval_roles?.role_name ?? "",
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await mappingsCtx();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = createBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const { data: role } = await ctx.supabase
      .from("approval_roles")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("id", body.approval_role_id)
      .maybeSingle();
    if (!role) return NextResponse.json({ error: "Role not found in org" }, { status: 400 });

    const { data, error } = await ctx.supabase
      .from("approval_mappings")
      .insert({
        org_id: ctx.orgId,
        trigger_type: body.trigger_type,
        trigger_value: body.trigger_value,
        approval_role_id: body.approval_role_id,
        priority: body.priority ?? 100,
        enabled: body.enabled ?? true,
      })
      .select("id, trigger_type, trigger_value, approval_role_id, priority, enabled, created_at, updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "org.settings.updated",
      entityType: "approval_mapping",
      entityId: data.id,
      metadata: { trigger_type: data.trigger_type, trigger_value: data.trigger_value },
    });

    return NextResponse.json({ ok: true, row: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
