import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const INVITE_EXPIRY_DAYS = 7;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canAccessInternalTab(gate.ctx.employeeRole, "team_access", { teamManage: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, inviteId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;

  const { data: invite, error: inviteErr } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  if (!invite || (invite as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if ((invite as { status: string }).status !== "PENDING") {
    return NextResponse.json({ error: "Invite is not pending" }, { status: 409 });
  }

  const email = String((invite as { email?: string }).email ?? "").toLowerCase();
  const role = String((invite as { role?: string }).role ?? "viewer").toLowerCase();

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
      invited_by_user_id: gate.ctx.user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const { data: orgRow } = await admin.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (orgRow as { name?: string } | null)?.name ?? "the organization";
  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  await sendInviteEmail({
    to: email,
    orgName,
    inviterName: gate.ctx.emailLower,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.account.invite_resent",
    targetType: "org_invite",
    targetId: newInvite.id,
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
