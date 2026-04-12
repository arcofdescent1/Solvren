import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

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
  const { data: invite } = await admin
    .from("org_invites")
    .select("id, org_id, email, status")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite || (invite as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if ((invite as { status: string }).status !== "PENDING") {
    return NextResponse.json({ error: "Invite is not pending" }, { status: 409 });
  }

  const { error } = await admin
    .from("org_invites")
    .update({ status: "REVOKED", updated_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.account.invite_revoked",
    targetType: "org_invite",
    targetId: inviteId,
    metadata: { email: (invite as { email?: string }).email },
  });

  return NextResponse.json({ ok: true });
}
