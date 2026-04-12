import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { isStoredOrgRole } from "@/lib/internal/storedOrgRoles";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const INVITE_EXPIRY_DAYS = 7;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "team_access", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;
  const { data: invites, error } = await admin
    .from("org_invites")
    .select("id, email, role, status, expires_at, created_at, invited_by_user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = invites ?? [];
  const inviterIds = [
    ...new Set(list.map((i) => (i as { invited_by_user_id?: string | null }).invited_by_user_id).filter(Boolean)),
  ] as string[];
  const inviterEmailById = new Map<string, string>();
  for (const uid of inviterIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) inviterEmailById.set(uid, u.user.email);
    } catch {
      /* ignore */
    }
  }

  const items = list.map((inv) => {
    const inviterId = (inv as { invited_by_user_id?: string | null }).invited_by_user_id ?? null;
    return {
      inviteId: (inv as { id: string }).id,
      email: String((inv as { email?: string }).email ?? "").toLowerCase(),
      role: String((inv as { role?: string }).role ?? "viewer").toLowerCase(),
      invitedAt: (inv as { created_at?: string }).created_at,
      invitedByUserId: inviterId,
      invitedByEmail: inviterId ? (inviterEmailById.get(inviterId) ?? null) : null,
      status: (inv as { status?: string }).status,
      expiresAt: (inv as { expires_at?: string | null }).expires_at ?? null,
    };
  });

  return NextResponse.json({ invites: items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canAccessInternalTab(gate.ctx.employeeRole, "team_access", { teamManage: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const rawRole = typeof body.role === "string" ? body.role : "viewer";
  if (rawRole !== rawRole.toLowerCase()) {
    return NextResponse.json({ error: "Role must be lowercase stored value" }, { status: 400 });
  }
  const role = isStoredOrgRole(rawRole) ? rawRole : null;
  if (!role) return NextResponse.json({ error: "Valid role required" }, { status: 400 });

  const admin = gate.ctx.admin;

  const { data: pendingInvite } = await admin
    .from("org_invites")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .eq("status", "PENDING")
    .maybeSingle();

  if (pendingInvite) {
    return NextResponse.json({
      ok: true,
      inviteId: (pendingInvite as { id: string }).id,
      reused: true,
    });
  }

  const { data: orgRow } = await admin.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (orgRow as { name?: string } | null)?.name ?? "the organization";

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const { data: invite, error: insertErr } = await admin
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

  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  const sendResult = await sendInviteEmail({
    to: email,
    orgName,
    inviterName: gate.ctx.emailLower,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });
  if (!sendResult.sent) {
    console.warn("[internal/invites] invite email failed:", sendResult.error);
  }

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.account.invite_created",
    targetType: "org_invite",
    targetId: invite.id,
    metadata: { email, role, inviteId: invite.id },
  });

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    email,
    role,
    expiresAt: expiresAt.toISOString(),
    emailSent: sendResult.sent,
  });
}
