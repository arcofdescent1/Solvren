import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

function isTableMissingError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("not found"))
  );
}

type CreateBody = {
  role_name: string;
  description?: string | null;
  enabled?: boolean;
  member_user_ids?: string[];
};

export async function GET() {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }

  const admin = createAdminClient();
  const orgId = auth.orgId;
  const { data: roles, error: roleErr } = await admin
    .from("approval_roles")
    .select("id, role_name, description, enabled, created_at, updated_at")
    .eq("org_id", orgId)
    .order("role_name", { ascending: true });
  if (roleErr) {
    if (isTableMissingError(roleErr))
      return NextResponse.json({ ok: true, rows: [] });
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }

  const roleIds = (roles ?? []).map((r) => r.id);
  const { data: members, error: memErr } = roleIds.length
    ? await admin
        .from("approval_role_members")
        .select("id, role_id, user_id, created_at")
        .eq("org_id", orgId)
        .in("role_id", roleIds)
    : { data: [], error: null };
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const byRole = new Map<string, Array<{ user_id: string; email: string | null; name: string | null }>>();
  for (const m of members ?? []) {
    const uid = String(m.user_id);
    let email: string | null = null;
    let name: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(uid);
      const u = data.user;
      email = u?.email ?? null;
      const meta = u?.user_metadata as Record<string, unknown> | undefined;
      name = (meta?.full_name as string) ?? (meta?.name as string) ?? null;
    } catch {}

    const arr = byRole.get(String(m.role_id)) ?? [];
    arr.push({ user_id: uid, email, name });
    byRole.set(String(m.role_id), arr);
  }

  const rows = (roles ?? []).map((r) => ({
    ...r,
    members: byRole.get(String(r.id)) ?? [],
  }));

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roleName = String(body.role_name ?? "").trim();
  if (!roleName) {
    return NextResponse.json({ error: "role_name required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const orgId = auth.orgId;
  const { data: role, error: roleErr } = await admin
    .from("approval_roles")
    .insert({
      org_id: orgId,
      role_name: roleName,
      description: body.description ?? null,
      enabled: body.enabled ?? true,
    })
    .select("id, role_name, description, enabled, created_at, updated_at")
    .single();
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

  const memberIds = Array.isArray(body.member_user_ids)
    ? [...new Set(body.member_user_ids.filter(Boolean))]
    : [];
  if (memberIds.length > 0) {
    const rows = memberIds.map((uid) => ({
      org_id: orgId,
      role_id: role.id,
      user_id: uid,
    }));
    const { error: insErr } = await admin.from("approval_role_members").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_role_created",
    entityType: "approval_role",
    entityId: role.id,
    metadata: { role_name: role.role_name, members: memberIds.length },
  });

  return NextResponse.json({ ok: true, row: role });
}
