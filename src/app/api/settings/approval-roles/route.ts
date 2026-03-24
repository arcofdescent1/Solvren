import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { createPrivilegedClient } from "@/lib/server/adminClient";
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
  role_name: z.string().trim().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  enabled: z.boolean().optional(),
  member_user_ids: z.array(z.string().uuid()).optional(),
});

async function rolesCtx() {
  const def = await resolveDefaultOrgForUser();
  return requireOrgPermission(def.orgId, "approval.mappings.manage");
}

export async function GET() {
  try {
    const ctx = await rolesCtx();
    const { data: roles, error: roleErr } = await ctx.supabase
      .from("approval_roles")
      .select("id, role_name, description, enabled, created_at, updated_at")
      .eq("org_id", ctx.orgId)
      .order("role_name", { ascending: true });
    if (roleErr) {
      if (isTableMissingError(roleErr)) return NextResponse.json({ ok: true, rows: [] });
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }

    const roleIds = (roles ?? []).map((r) => r.id);
    const { data: members, error: memErr } = roleIds.length
      ? await ctx.supabase
          .from("approval_role_members")
          .select("id, role_id, user_id, created_at")
          .eq("org_id", ctx.orgId)
          .in("role_id", roleIds)
      : { data: [], error: null };
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

    const privileged = createPrivilegedClient(
      "GET /api/settings/approval-roles: auth.admin.getUserById for member emails"
    );
    const byRole = new Map<string, Array<{ user_id: string; email: string | null; name: string | null }>>();
    for (const m of members ?? []) {
      const uid = String(m.user_id);
      let email: string | null = null;
      let name: string | null = null;
      try {
        const { data } = await privileged.auth.admin.getUserById(uid);
        const u = data.user;
        email = u?.email ?? null;
        const meta = u?.user_metadata as Record<string, unknown> | undefined;
        name = (meta?.full_name as string) ?? (meta?.name as string) ?? null;
      } catch {
        /* leave null */
      }

      const arr = byRole.get(String(m.role_id)) ?? [];
      arr.push({ user_id: uid, email, name });
      byRole.set(String(m.role_id), arr);
    }

    const rows = (roles ?? []).map((r) => ({
      ...r,
      members: byRole.get(String(r.id)) ?? [],
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await rolesCtx();
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

    const { data: role, error: roleErr } = await ctx.supabase
      .from("approval_roles")
      .insert({
        org_id: ctx.orgId,
        role_name: body.role_name,
        description: body.description ?? null,
        enabled: body.enabled ?? true,
      })
      .select("id, role_name, description, enabled, created_at, updated_at")
      .single();
    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

    const memberIds = [...new Set(body.member_user_ids ?? [])];
    if (memberIds.length > 0) {
      const rows = memberIds.map((uid) => ({
        org_id: ctx.orgId,
        role_id: role.id,
        user_id: uid,
      }));
      const { error: insErr } = await ctx.supabase.from("approval_role_members").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "org.settings.updated",
      entityType: "approval_role",
      entityId: role.id,
      metadata: { role_name: role.role_name, members: memberIds.length },
    });

    return NextResponse.json({ ok: true, row: role });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
