import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { listCanonicalIntegrations } from "@/lib/internal/phase2/integrationsReadModel";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "integrations", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.integrations.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await maybeLogInternalTabView(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    tab: "integrations",
  });

  const { items, summary } = await listCanonicalIntegrations(gate.ctx.admin, orgId);
  return NextResponse.json({ summary, items });
}
