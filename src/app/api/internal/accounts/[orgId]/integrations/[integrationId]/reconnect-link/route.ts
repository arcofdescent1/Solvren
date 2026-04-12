import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { generateReconnectAuthUrl, resolveIntegrationTarget } from "@/lib/internal/phase2/integrationsReadModel";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
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
  if (!target || target.kind !== "account") {
    return NextResponse.json({ error: "Reconnect not supported for this integration" }, { status: 403 });
  }

  const origin = req.nextUrl.origin;
  const urlResult = await generateReconnectAuthUrl(gate.ctx.admin, {
    orgId,
    employeeUserId: gate.ctx.user.id,
    provider: target.provider,
    appOrigin: origin,
  });
  if ("error" in urlResult) {
    return NextResponse.json({ error: "Provider does not support reconnect" }, { status: 403 });
  }

  await logInternalAudit(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.integration.reconnect_link.generated",
    targetType: "integration",
    targetId: integrationId,
    metadata: { provider: target.provider },
  });

  return NextResponse.json({ url: urlResult.authUrl });
}
