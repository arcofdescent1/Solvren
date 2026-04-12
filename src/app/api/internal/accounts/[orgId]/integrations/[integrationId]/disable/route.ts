import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { resolveIntegrationTarget } from "@/lib/internal/phase2/integrationsReadModel";
import { canAccessInternalTab, canDisableEnableIntegration, internalHasPermission } from "@/lib/internal/permissions";
import { disconnectIntegration } from "@/modules/integrations/auth/connectionManager";
import { getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";

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
  if (!canDisableEnableIntegration(gate.ctx.employeeRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, integrationId } = await params;
  let body: { reason?: string };
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3) {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }

  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;
  const target = await resolveIntegrationTarget(admin, orgId, integrationId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.kind === "account") {
    const { data: acc } = await getAccountById(admin, target.accountId);
    if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (acc.status === "disconnected" || acc.disconnected_at) {
      return NextResponse.json({ ok: true, alreadyApplied: true });
    }
    const d = await disconnectIntegration(admin, {
      orgId,
      integrationAccountId: target.accountId,
      userId: gate.ctx.user.id,
    });
    if (d.error) return NextResponse.json({ error: d.error }, { status: 500 });
  } else {
    const { data: row } = await admin
      .from("integration_connections")
      .select("id, status")
      .eq("id", target.connectionId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (String((row as { status: string }).status) === "disconnected") {
      return NextResponse.json({ ok: true, alreadyApplied: true });
    }
    const { error } = await admin
      .from("integration_connections")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("id", target.connectionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.integration.disabled",
    targetType: "integration",
    targetId: integrationId,
    reason,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
