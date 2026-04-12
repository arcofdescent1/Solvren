import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { countOwners } from "@/lib/internal/memberMutations";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { isStoredOrgRole } from "@/lib/internal/storedOrgRoles";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberUserId: string }> }
) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canAccessInternalTab(gate.ctx.employeeRole, "team_access", { teamManage: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, memberUserId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { role?: string };
  try {
    body = (await req.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawRole = typeof body.role === "string" ? body.role : "";
  if (rawRole !== rawRole.toLowerCase()) {
    return NextResponse.json({ error: "Role must be lowercase stored value" }, { status: 400 });
  }
  if (!isStoredOrgRole(rawRole)) {
    return NextResponse.json({ error: "Valid role required" }, { status: 400 });
  }
  const newRole = rawRole;

  const admin = gate.ctx.admin;

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const currentRole = String((member as { role?: string }).role ?? "").toLowerCase();

  if (currentRole === "owner") {
    const ownerCount = await countOwners(admin, orgId);
    if (ownerCount <= 1 && newRole !== "owner") {
      return NextResponse.json(
        { error: "Cannot demote the last owner. Promote another member to owner first." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ role: newRole })
    .eq("org_id", orgId)
    .eq("user_id", memberUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.account.member_role_changed",
    targetType: "organization_member",
    targetId: memberUserId,
    metadata: { previousRole: currentRole, newRole },
  });

  return NextResponse.json({ ok: true, role: newRole });
}
