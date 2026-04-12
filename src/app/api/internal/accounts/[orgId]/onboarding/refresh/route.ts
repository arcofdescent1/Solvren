import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { evaluateAndUpdateOnboarding } from "@/modules/onboarding/services/onboarding-tracker.service";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "onboarding", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.onboarding.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await evaluateAndUpdateOnboarding(gate.ctx.admin, orgId);

  await logInternalAudit(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.onboarding.refresh",
    targetType: "organization",
    targetId: orgId,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
