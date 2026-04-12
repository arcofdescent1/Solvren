import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "audit", { teamManage })) {
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
    tab: "audit",
  });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25") || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = gate.ctx.admin;
  const { data: rows, error, count } = await admin
    .from("internal_admin_audit_log")
    .select(
      "id, created_at, action, employee_user_id, employee_email, employee_role, target_type, target_id, reason, metadata",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (rows ?? []).map((r) => ({
    id: (r as { id: string }).id,
    createdAt: (r as { created_at: string }).created_at,
    action: (r as { action: string }).action,
    employeeUserId: (r as { employee_user_id: string }).employee_user_id,
    employeeEmail: (r as { employee_email: string }).employee_email,
    employeeRole: (r as { employee_role: string }).employee_role,
    targetType: (r as { target_type: string }).target_type,
    targetId: (r as { target_id: string | null }).target_id,
    reason: (r as { reason: string | null }).reason,
    metadata: (r as { metadata: Record<string, unknown> }).metadata ?? {},
  }));

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: count ?? items.length,
  });
}
