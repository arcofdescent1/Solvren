import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type PatchBody = { role_label?: string; approval_area?: string };

async function requireAdminOrg(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { user: null, orgId: null, status: 401 as const };
  const { data: orgRow } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const row = orgRow as { org_id?: string; role?: string } | null;
  if (!row?.org_id) return { user: userRes.user, orgId: null, status: 401 as const };
  if (!isAdminLikeRole(parseOrgRole(row.role ?? null)))
    return { user: userRes.user, orgId: row.org_id, status: 403 as const };
  return { user: userRes.user, orgId: row.org_id, status: null };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403)
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const orgId = auth.orgId as string;
  const admin = createAdminClient();

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
    actorId: auth.user!.id,
    action: "APPROVAL_ROLE_MAP_UPDATED",
    entityType: "approval_role_map",
    entityId: id,
    metadata: { row },
  });

  return NextResponse.json({ ok: true, row });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403)
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await ctx.params;
  const orgId = auth.orgId as string;
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("approval_role_map")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("approval_role_map").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "APPROVAL_ROLE_MAP_DELETED",
    entityType: "approval_role_map",
    entityId: id,
    metadata: { before },
  });

  return NextResponse.json({ ok: true });
}
