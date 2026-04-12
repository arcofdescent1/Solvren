import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import {
  MANUAL_OVERRIDE_KEYS,
  type ChecklistItemStatus,
} from "@/lib/internal/phase2/onboardingInternal";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

const ALLOWED_STATUS: ChecklistItemStatus[] = ["complete", "not_started", "in_progress", "blocked", "unknown"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; itemKey: string }> }
) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "onboarding", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.onboarding.override")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, itemKey } = await params;
  if (!MANUAL_OVERRIDE_KEYS.has(itemKey)) {
    return NextResponse.json({ error: "Item is not manually overridable" }, { status: 409 });
  }

  let body: { status?: string; reason?: string };
  try {
    body = (await req.json()) as { status?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!ALLOWED_STATUS.includes(status as ChecklistItemStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (reason.length < 8) {
    return NextResponse.json({ error: "reason must be at least 8 characters" }, { status: 400 });
  }

  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;
  const { error } = await admin.from("internal_onboarding_overrides").insert({
    org_id: orgId,
    item_key: itemKey,
    status,
    reason,
    employee_user_id: gate.ctx.user.id,
    employee_email: gate.ctx.emailLower,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.onboarding.item.updated",
    targetType: "onboarding_item",
    targetId: itemKey,
    reason,
    metadata: { status },
  });

  return NextResponse.json({ ok: true });
}
