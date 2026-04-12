import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { countOwners } from "@/lib/internal/memberMutations";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function POST(
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

  let body: { reason?: string };
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3) {
    return NextResponse.json({ error: "reason is required (min 3 characters)" }, { status: 400 });
  }

  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 409 });
  }

  const role = String((member as { role?: string }).role ?? "").toLowerCase();
  if (role === "owner") {
    const ownerCount = await countOwners(admin, orgId);
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner. Promote another member to owner first." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin.from("organization_members").delete().eq("org_id", orgId).eq("user_id", memberUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.account.member_removed",
    targetType: "organization_member",
    targetId: memberUserId,
    reason,
    metadata: { removedRole: role },
  });

  return NextResponse.json({ ok: true });
}
