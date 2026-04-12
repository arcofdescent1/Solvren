import { NextResponse } from "next/server";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import {
  canAccessInternalTab,
  internalHasPermission,
  type InternalWorkspaceTab,
} from "@/lib/internal/permissions";

export const runtime = "nodejs";

const ALL_TABS: InternalWorkspaceTab[] = [
  "overview",
  "onboarding",
  "team_access",
  "integrations",
  "billing",
  "diagnostics",
  "audit",
];

export async function GET() {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const role = gate.ctx.employeeRole;
  const teamManage = internalHasPermission(role, "internal.accounts.team.manage");

  const tabs: Record<InternalWorkspaceTab, boolean> = {
    overview: canAccessInternalTab(role, "overview", { teamManage }),
    onboarding: canAccessInternalTab(role, "onboarding", { teamManage }),
    team_access: canAccessInternalTab(role, "team_access", { teamManage }),
    integrations: canAccessInternalTab(role, "integrations", { teamManage }),
    billing: canAccessInternalTab(role, "billing", { teamManage }),
    diagnostics: canAccessInternalTab(role, "diagnostics", { teamManage }),
    audit: canAccessInternalTab(role, "audit", { teamManage }),
  };

  return NextResponse.json({
    email: gate.ctx.emailLower,
    employeeRole: role,
    tabs,
    tabOrder: ALL_TABS.filter((t) => tabs[t]),
    permissions: {
      billingView: internalHasPermission(role, "internal.accounts.billing.view"),
      billingManage: internalHasPermission(role, "internal.accounts.billing.manage"),
      teamManage,
      onboardingView: internalHasPermission(role, "internal.accounts.onboarding.view"),
      onboardingManage: internalHasPermission(role, "internal.accounts.onboarding.manage"),
      onboardingOverride: internalHasPermission(role, "internal.accounts.onboarding.override"),
      integrationsView: internalHasPermission(role, "internal.accounts.integrations.view"),
      integrationsManage: internalHasPermission(role, "internal.accounts.integrations.manage"),
      diagnosticsView: internalHasPermission(role, "internal.accounts.diagnostics.view"),
      diagnosticsRemediate: internalHasPermission(role, "internal.accounts.diagnostics.remediate"),
      integrationDisableEnable: role === "technical_support" || role === "super_admin",
    },
  });
}
