import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { resolveIntegrationTarget, runIntegrationHealthCheck } from "@/lib/internal/phase2/integrationsReadModel";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; integrationId: string }> }
) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "integrations", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.integrations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, integrationId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = await resolveIntegrationTarget(gate.ctx.admin, orgId, integrationId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = await runIntegrationHealthCheck(gate.ctx.admin, target);

  await logInternalAudit(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.integration.health_check.requested",
    targetType: "integration",
    targetId: integrationId,
    metadata: { status },
  });

  return NextResponse.json({ ok: true, status });
}
