import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import type { BillingRow } from "@/lib/internal/billingPortal";
import { computePortalEligible } from "@/lib/internal/billingPortal";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { planFromString } from "@/services/billing/entitlements";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.billing.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "billing", { teamManage })) {
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
    tab: "billing",
  });

  const { data: billing } = await gate.ctx.admin
    .from("billing_accounts")
    .select("org_id, plan_key, status, stripe_customer_id, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  const row = (billing as BillingRow | null) ?? null;
  const plan = row ? planFromString(row.plan_key) : planFromString("FREE");
  const portalEligible = computePortalEligible(row);

  return NextResponse.json({
    orgId,
    plan,
    billingStatus: row?.status ?? "ACTIVE",
    stripeCustomerIdPresent: Boolean(row?.stripe_customer_id),
    currentPeriodEnd: row?.current_period_end ?? null,
    portalEligible,
  });
}
