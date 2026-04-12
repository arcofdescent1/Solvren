import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { computeLastActivityAt } from "@/lib/internal/lastActivity";
import { onboardingPhaseSummaryFromState } from "@/lib/internal/onboardingPhaseSummary";
import { internalHasPermission } from "@/lib/internal/permissions";
import { planFromString } from "@/services/billing/entitlements";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.view")) {
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
    tab: "overview",
  });

  const admin = gate.ctx.admin;
  const [{ data: billing }, { data: ob }] = await Promise.all([
    admin.from("billing_accounts").select("plan_key, status, stripe_customer_id, current_period_end").eq("org_id", orgId).maybeSingle(),
    admin
      .from("org_onboarding_states")
      .select("guided_phase1_status, phase2_status, phase3_status, phase4_status")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const plan = billing ? planFromString((billing as { plan_key?: string }).plan_key) : planFromString("FREE");
  const billingStatus = (billing as { status?: string } | null)?.status ?? null;
  const onboardingPhaseSummary = onboardingPhaseSummaryFromState(
    (ob ?? null) as Parameters<typeof onboardingPhaseSummaryFromState>[0]
  );
  const lastActivityAt = await computeLastActivityAt(admin, orgId, org.created_at);

  return NextResponse.json({
    orgId: org.id,
    name: org.name,
    slug: org.slug,
    plan,
    billingStatus,
    onboardingPhaseSummary,
    lastActivityAt,
    createdAt: org.created_at,
  });
}
