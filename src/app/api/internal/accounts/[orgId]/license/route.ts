import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit, maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import {
  buildLicenseEntitlements,
  defaultEnterpriseLicenseScope,
  licenseScopeFromBilling,
  licenseScopeFromRow,
  normalizeImplementationMode,
  normalizeLicenseStatus,
  normalizeLicenseTier,
  normalizePremiumModules,
  normalizeProtectedRevenueBand,
  type ImplementationMode,
  type LicenseScope,
  type LicenseTier,
  type PremiumModule,
  type ProtectedRevenueBand,
} from "@/services/licensing";

export const runtime = "nodejs";

type LicenseRow = {
  license_tier: string;
  status: string;
  protected_revenue_band: string;
  contract_start: string | null;
  contract_end: string | null;
  renewal_date: string | null;
  licensed_business_units: number | null;
  licensed_integrations: string[] | null;
  licensed_domains: string[] | null;
  included_admin_seats: number | null;
  unlimited_executive_access: boolean | null;
  premium_modules: string[] | null;
  implementation_mode: string;
  account_manager_user_id: string | null;
  customer_success_owner_user_id: string | null;
  order_form_reference: string | null;
  commercial_notes: string | null;
};

type PatchBody = {
  tier?: string;
  status?: string;
  protectedRevenueBand?: string;
  contractStart?: string | null;
  contractEnd?: string | null;
  renewalDate?: string | null;
  licensedBusinessUnits?: number | null;
  licensedIntegrations?: string[] | null;
  licensedDomains?: string[] | null;
  includedAdminSeats?: number | null;
  unlimitedExecutiveAccess?: boolean | null;
  premiumModules?: string[] | null;
  implementationMode?: string | null;
  accountManagerUserId?: string | null;
  customerSuccessOwnerUserId?: string | null;
  orderFormReference?: string | null;
  commercialNotes?: string | null;
};

const SELECT_COLUMNS =
  "license_tier,status,protected_revenue_band,contract_start,contract_end,renewal_date,licensed_business_units,licensed_integrations,licensed_domains,included_admin_seats,unlimited_executive_access,premium_modules,implementation_mode,account_manager_user_id,customer_success_owner_user_id,order_form_reference,commercial_notes";

function csvish(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return Array.from(new Set(v.map((item) => String(item).trim()).filter(Boolean)));
  return Array.from(new Set(String(v).split(",").map((item) => item.trim()).filter(Boolean)));
}

function dateOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function numberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function toResponse(row: LicenseRow | null, fallback: LicenseScope) {
  const scope = row ? licenseScopeFromRow(row) : fallback;
  const entitlements = buildLicenseEntitlements(scope);
  return {
    license: {
      tier: entitlements.tier,
      status: entitlements.status,
      protectedRevenueBand: entitlements.protectedRevenueBand,
      contractStart: row?.contract_start ?? scope.contractStart ?? null,
      contractEnd: row?.contract_end ?? scope.contractEnd ?? null,
      renewalDate: row?.renewal_date ?? scope.renewalDate ?? null,
      licensedBusinessUnits: entitlements.licensedBusinessUnits,
      licensedIntegrations: entitlements.licensedIntegrations,
      licensedDomains: entitlements.licensedDomains,
      includedAdminSeats: entitlements.includedAdminSeats,
      unlimitedExecutiveAccess: entitlements.unlimitedExecutiveAccess,
      premiumModules: entitlements.premiumModules,
      implementationMode: entitlements.implementationMode,
      accountManagerUserId: row?.account_manager_user_id ?? scope.accountManagerUserId ?? null,
      customerSuccessOwnerUserId: row?.customer_success_owner_user_id ?? scope.customerSuccessOwnerUserId ?? null,
      orderFormReference: row?.order_form_reference ?? scope.orderFormReference ?? null,
      commercialNotes: row?.commercial_notes ?? null,
      capabilities: entitlements.capabilities,
      source: row ? "organization_licenses" : "billing_accounts",
    },
  };
}

async function loadLicense(gate: Awaited<ReturnType<typeof requireInternalEmployeeApi>> & { ok: true }, orgId: string) {
  const { data: license } = await gate.ctx.admin
    .from("organization_licenses")
    .select(SELECT_COLUMNS)
    .eq("org_id", orgId)
    .maybeSingle();
  if (license) {
    return { row: license as LicenseRow, fallback: defaultEnterpriseLicenseScope("FREE") };
  }

  const { data: billing } = await gate.ctx.admin
    .from("billing_accounts")
    .select("plan_key,status,current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();
  return { row: null, fallback: licenseScopeFromBilling(billing as Parameters<typeof licenseScopeFromBilling>[0]) };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "license", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.license.view")) {
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
    tab: "license",
  });

  const loaded = await loadLicense(gate, orgId);
  return NextResponse.json({ orgId, ...toResponse(loaded.row, loaded.fallback) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.license.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const previous = await loadLicense(gate, orgId);
  const previousScope = previous.row ? licenseScopeFromRow(previous.row) : previous.fallback;

  const tier = normalizeLicenseTier(body.tier ?? previousScope.tier) as LicenseTier;
  const status = normalizeLicenseStatus(body.status ?? previousScope.status);
  const implementationMode = normalizeImplementationMode(body.implementationMode ?? previousScope.implementationMode, tier) as ImplementationMode;
  const protectedRevenueBand = normalizeProtectedRevenueBand(
    body.protectedRevenueBand ?? previousScope.protectedRevenueBand
  ) as ProtectedRevenueBand;
  const premiumModules = normalizePremiumModules(body.premiumModules ?? previousScope.premiumModules) as PremiumModule[];

  const nextRow = {
    org_id: orgId,
    license_tier: tier,
    status,
    protected_revenue_band: protectedRevenueBand,
    contract_start: dateOrNull(body.contractStart ?? previousScope.contractStart),
    contract_end: dateOrNull(body.contractEnd ?? previousScope.contractEnd),
    renewal_date: dateOrNull(body.renewalDate ?? previousScope.renewalDate),
    licensed_business_units: numberOrNull(body.licensedBusinessUnits ?? previousScope.licensedBusinessUnits),
    licensed_integrations: csvish(body.licensedIntegrations ?? previousScope.licensedIntegrations),
    licensed_domains: csvish(body.licensedDomains ?? previousScope.licensedDomains),
    included_admin_seats: numberOrNull(body.includedAdminSeats ?? previousScope.includedAdminSeats),
    unlimited_executive_access:
      body.unlimitedExecutiveAccess ??
      previousScope.unlimitedExecutiveAccess ??
      (tier === "BUSINESS" || tier === "ENTERPRISE" || tier === "STRATEGIC_ENTERPRISE"),
    premium_modules: premiumModules,
    implementation_mode: implementationMode,
    account_manager_user_id: body.accountManagerUserId ?? previousScope.accountManagerUserId ?? null,
    customer_success_owner_user_id: body.customerSuccessOwnerUserId ?? previousScope.customerSuccessOwnerUserId ?? null,
    order_form_reference: body.orderFormReference ?? previousScope.orderFormReference ?? null,
    commercial_notes: body.commercialNotes ?? previous.row?.commercial_notes ?? null,
  };

  const { data, error } = await gate.ctx.admin
    .from("organization_licenses")
    .upsert(nextRow, { onConflict: "org_id" })
    .select(SELECT_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await gate.ctx.admin.from("organizations").update({ plan_tier: tier }).eq("id", orgId);

  const nextScope = licenseScopeFromRow(data as LicenseRow);
  await gate.ctx.admin.from("organization_license_events").insert({
    org_id: orgId,
    actor_user_id: gate.ctx.user.id,
    event_type: "license.updated",
    previous_license: buildLicenseEntitlements(previousScope),
    next_license: buildLicenseEntitlements(nextScope),
    notes: body.commercialNotes ?? null,
  });
  await logInternalAudit(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.license.update",
    targetType: "organization_license",
    targetId: orgId,
    metadata: { tier, protectedRevenueBand, implementationMode },
  });

  return NextResponse.json({ orgId, ...toResponse(data as LicenseRow, nextScope) });
}
