import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

async function requireAdminOrg(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return { user: null, orgId: null, status: 401 as const };
  const { data: row } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const r = row as { org_id?: string; role?: string } | null;
  if (!r?.org_id) return { user: userRes.user, orgId: null, status: 401 as const };
  if (!isAdminLikeRole(parseOrgRole(r.role ?? null))) {
    return { user: userRes.user, orgId: r.org_id, status: 403 as const };
  }
  return { user: userRes.user, orgId: r.org_id, status: null };
}

/**
 * POST /api/org/invites/revoke — Revoke a pending invite (admin only).
 * Body: { inviteId: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { inviteId?: string };
  try {
    body = (await req.json()) as { inviteId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const inviteId = body.inviteId;
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  const { data: invite } = await supabase
    .from("org_invites")
    .select("id, org_id, email, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite || invite.org_id !== auth.orgId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("org_invites")
    .update({ status: "REVOKED", updated_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(admin, {
    orgId: auth.orgId!,
    actorId: auth.user!.id,
    actorType: "USER",
    action: "invite_revoked",
    entityType: "org_invite",
    entityId: inviteId,
    metadata: { email: invite.email },
  });

  return NextResponse.json({ ok: true });
}
