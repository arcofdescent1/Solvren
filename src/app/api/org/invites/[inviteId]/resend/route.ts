import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

const INVITE_EXPIRY_DAYS = 7;

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
 * POST /api/org/invites/:inviteId/resend — Resend invite (admin only).
 * Revokes the current invite and creates a new one (Option B).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { inviteId } = await params;
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

  const admin = createAdminClient();
  const orgId = auth.orgId!;

  const { data: invite, error: inviteErr } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  if (!invite || invite.org_id !== orgId) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });
  }

  const email = String(invite.email ?? "").toLowerCase();
  const role = String(invite.role ?? "viewer");

  await admin
    .from("org_invites")
    .update({ status: "REVOKED", updated_at: new Date().toISOString() })
    .eq("id", inviteId);

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const { data: newInvite, error: insertErr } = await admin
    .from("org_invites")
    .insert({
      org_id: orgId,
      email,
      role,
      token_hash: tokenHash,
      status: "PENDING",
      invited_by_user_id: auth.user!.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org as { name?: string } | null)?.name ?? "the organization";
  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  const inviterName = auth.user!.email ?? null;
  await sendInviteEmail({
    to: email,
    orgName,
    inviterName,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  await auditLog(admin, {
    orgId,
    actorId: auth.user!.id,
    actorType: "USER",
    action: "invite_created",
    entityType: "org_invite",
    entityId: newInvite.id,
    metadata: { email, role, inviteId: newInvite.id, resendOf: inviteId },
  });

  return NextResponse.json({
    ok: true,
    inviteId: newInvite.id,
    email,
    role,
    expiresAt: expiresAt.toISOString(),
  });
}
