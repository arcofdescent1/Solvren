import { NextRequest, NextResponse } from "next/server";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { listInternalAccounts } from "@/lib/internal/accountQueries";
import { internalHasPermission } from "@/lib/internal/permissions";
import { planFromString } from "@/services/billing/entitlements";
import type { OnboardingPhaseSummary } from "@/lib/internal/onboardingPhaseSummary";

export const runtime = "nodejs";

const ONBOARDING_VALUES: readonly OnboardingPhaseSummary[] = [
  "not_started",
  "phase_1_in_progress",
  "phase_2_in_progress",
  "phase_3_in_progress",
  "phase_4_in_progress",
  "complete",
  "unknown",
];

function parseOnboardingSummary(v: string | null): OnboardingPhaseSummary | undefined {
  if (!v) return undefined;
  return ONBOARDING_VALUES.includes(v as OnboardingPhaseSummary) ? (v as OnboardingPhaseSummary) : undefined;
}

export async function GET(req: NextRequest) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25") || 25));
  const q = url.searchParams.get("q")?.trim() || undefined;
  const planRaw = url.searchParams.get("plan")?.trim();
  const plan = planRaw ? planFromString(planRaw) : undefined;
  const billingStatus = url.searchParams.get("billingStatus")?.trim() || undefined;
  const onboardingPhaseSummary = parseOnboardingSummary(url.searchParams.get("onboardingPhaseSummary")?.trim() ?? null);
  const hi = url.searchParams.get("hasIntegration");
  const hasIntegration = hi === "true" ? true : hi === "false" ? false : undefined;

  try {
    const { items, total, page: p, pageSize: ps } = await listInternalAccounts({
      admin: gate.ctx.admin,
      page,
      pageSize,
      q,
      plan,
      billingStatus,
      onboardingPhaseSummary,
      hasIntegration,
    });

    return NextResponse.json({
      items: items.map((it) => ({
        orgId: it.orgId,
        name: it.name,
        slug: it.slug,
        plan: it.plan,
        billingStatus: it.billingStatus,
        onboardingPhaseSummary: it.onboardingPhaseSummary,
        memberCount: it.memberCount,
        pendingInviteCount: it.pendingInviteCount,
        integrationCount: it.integrationCount,
        lastActivityAt: it.lastActivityAt,
      })),
      page: p,
      pageSize: ps,
      total,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
