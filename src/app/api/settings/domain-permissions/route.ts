import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";

async function requireOwnerAdmin(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false as const, status: 401 as const, supabase, userId: null };
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null))) {
    return { ok: false as const, status: 403 as const, supabase, userId: userRes.user.id };
  }
  return { ok: true as const, status: null, supabase, userId: userRes.user.id };
}

export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const auth = await requireOwnerAdmin(orgId);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status });

  const admin = createAdminClient();
  const [{ data: members }, { data: domains }, { data: perms }] = await Promise.all([
    admin
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    admin
      .from("domains")
      .select("key, name, is_active")
      .eq("is_active", true)
      .order("key", { ascending: true }),
    admin
      .from("user_domain_permissions")
      .select("id, user_id, domain, can_view, can_review")
      .eq("org_id", orgId),
  ]);

  const userRows = [];
  for (const m of members ?? []) {
    let email: string | null = null;
    let name: string | null = null;
    try {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
      email = userData?.user?.email ?? null;
      const meta = userData?.user?.user_metadata as Record<string, unknown> | undefined;
      name = (meta?.full_name as string) ?? (meta?.name as string) ?? null;
    } catch {
      // ignore best effort
    }
    userRows.push({
      user_id: m.user_id,
      role: m.role,
      email,
      name,
    });
  }

  return NextResponse.json({
    ok: true,
    users: userRows,
    domains: domains ?? [],
    permissions: perms ?? [],
  });
}

type UpsertBody = {
  orgId: string;
  userId: string;
  domain: string;
  canView: boolean;
  canReview: boolean;
};

export async function POST(req: NextRequest) {
  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.orgId || !body.userId || !body.domain) {
    return NextResponse.json({ error: "orgId, userId, domain required" }, { status: 400 });
  }
  const auth = await requireOwnerAdmin(body.orgId);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status });

  const admin = createAdminClient();
  if (!body.canView && !body.canReview) {
    const { error } = await admin
      .from("user_domain_permissions")
      .delete()
      .eq("org_id", body.orgId)
      .eq("user_id", body.userId)
      .eq("domain", body.domain);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("user_domain_permissions")
      .upsert(
        {
          org_id: body.orgId,
          user_id: body.userId,
          domain: body.domain,
          can_view: Boolean(body.canView),
          can_review: Boolean(body.canReview),
        },
        { onConflict: "org_id,user_id,domain" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(admin, {
    orgId: body.orgId,
    actorId: auth.userId,
    actorType: "USER",
    action: "domain_permission_updated",
    entityType: "user_domain_permissions",
    entityId: `${body.userId}:${body.domain}`,
    metadata: { user_id: body.userId, domain: body.domain, can_view: body.canView, can_review: body.canReview },
  });

  return NextResponse.json({ ok: true });
}
