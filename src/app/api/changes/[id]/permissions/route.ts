import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canGrantRestrictedAccess, canViewChange } from "@/lib/access/changeAccess";
import { auditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", id)
    .maybeSingle();
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const canManage = await canGrantRestrictedAccess(supabase, userRes.user.id, change);
  if (!canManage) return NextResponse.json({ ok: true, grants: [], members: [], canManage: false });

  const admin = createAdminClient();
  const [{ data: grants }, { data: members }] = await Promise.all([
    admin
      .from("change_permissions")
      .select("id, user_id, access_type, created_at, expires_at")
      .eq("change_event_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", change.org_id)
      .order("created_at", { ascending: true }),
  ]);

  const people = [];
  for (const m of members ?? []) {
    let email: string | null = null;
    let name: string | null = null;
    try {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
      email = userData?.user?.email ?? null;
      const meta = userData?.user?.user_metadata as Record<string, unknown> | undefined;
      name = (meta?.full_name as string) ?? (meta?.name as string) ?? null;
    } catch {
      // ignore
    }
    people.push({ user_id: m.user_id, role: m.role, email, name });
  }

  return NextResponse.json({ ok: true, canManage: true, grants: grants ?? [], members: people });
}

type Body = {
  userId: string;
  accessType?: "VIEW";
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: change } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", id)
    .maybeSingle();
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canManage = await canGrantRestrictedAccess(supabase, userRes.user.id, change);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const accessType = body.accessType ?? "VIEW";
  const { error } = await admin
    .from("change_permissions")
    .upsert(
      {
        org_id: change.org_id,
        change_event_id: id,
        user_id: body.userId,
        access_type: accessType,
        created_by: userRes.user.id,
      },
      { onConflict: "change_event_id,user_id,access_type" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(admin, {
    orgId: change.org_id,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "restricted_access_granted",
    entityType: "change_permissions",
    entityId: id,
    metadata: { granted_user_id: body.userId, access_type: accessType },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const grantId = url.searchParams.get("grantId");
  if (!grantId) return NextResponse.json({ error: "grantId required" }, { status: 400 });

  const { data: change } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", id)
    .maybeSingle();
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canManage = await canGrantRestrictedAccess(supabase, userRes.user.id, change);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("change_permissions")
    .select("user_id, access_type")
    .eq("id", grantId)
    .eq("change_event_id", id)
    .maybeSingle();

  const { error } = await admin
    .from("change_permissions")
    .delete()
    .eq("id", grantId)
    .eq("change_event_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(admin, {
    orgId: change.org_id,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "restricted_access_revoked",
    entityType: "change_permissions",
    entityId: id,
    metadata: { revoked_user_id: grant?.user_id ?? null, access_type: grant?.access_type ?? null },
  });

  return NextResponse.json({ ok: true });
}
