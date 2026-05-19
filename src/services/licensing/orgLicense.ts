import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLicenseEntitlements } from "./entitlements";
import { normalizeLicenseTier, normalizePremiumModules } from "./normalize";
import type { LicenseEntitlements, LicenseScope, LicenseTier } from "./types";

type LicenseRow = {
  license_tier?: string | null;
  status?: string | null;
  protected_revenue_band?: string | null;
  licensed_business_units?: number | null;
  licensed_integrations?: string[] | null;
  licensed_domains?: string[] | null;
  included_admin_seats?: number | null;
  unlimited_executive_access?: boolean | null;
  premium_modules?: string[] | null;
  implementation_mode?: string | null;
  account_manager_user_id?: string | null;
  customer_success_owner_user_id?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  renewal_date?: string | null;
  order_form_reference?: string | null;
};

type BillingRow = {
  plan_key?: string | null;
  status?: string | null;
  current_period_end?: string | null;
};

export function licenseScopeFromBilling(row: BillingRow | null | undefined): LicenseScope {
  return {
    tier: normalizeLicenseTier(row?.plan_key),
    status: row?.status ?? "ACTIVE",
    renewalDate: row?.current_period_end ?? null,
  };
}

export function licenseScopeFromRow(row: LicenseRow): LicenseScope {
  const tier = normalizeLicenseTier(row.license_tier);
  return {
    tier,
    status: row.status ?? "ACTIVE",
    protectedRevenueBand: row.protected_revenue_band as LicenseScope["protectedRevenueBand"],
    licensedBusinessUnits: row.licensed_business_units ?? null,
    licensedIntegrations: row.licensed_integrations ?? null,
    licensedDomains: row.licensed_domains ?? null,
    includedAdminSeats: row.included_admin_seats ?? null,
    unlimitedExecutiveAccess: row.unlimited_executive_access ?? null,
    premiumModules: normalizePremiumModules(row.premium_modules),
    implementationMode: row.implementation_mode as LicenseScope["implementationMode"],
    accountManagerUserId: row.account_manager_user_id ?? null,
    customerSuccessOwnerUserId: row.customer_success_owner_user_id ?? null,
    contractStart: row.contract_start ?? null,
    contractEnd: row.contract_end ?? null,
    renewalDate: row.renewal_date ?? null,
    orderFormReference: row.order_form_reference ?? null,
  };
}

export async function getOrgLicenseEntitlements(
  client: SupabaseClient,
  orgId: string
): Promise<LicenseEntitlements> {
  const licenseRes = await client
    .from("organization_licenses")
    .select(
      "license_tier,status,protected_revenue_band,licensed_business_units,licensed_integrations,licensed_domains,included_admin_seats,unlimited_executive_access,premium_modules,implementation_mode,account_manager_user_id,customer_success_owner_user_id,contract_start,contract_end,renewal_date,order_form_reference"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (licenseRes.data) {
    return buildLicenseEntitlements(licenseScopeFromRow(licenseRes.data as LicenseRow));
  }
  if (licenseRes.error && licenseRes.error.code !== "PGRST116") {
    const msg = licenseRes.error.message.toLowerCase();
    if (!msg.includes("organization_licenses") && !msg.includes("does not exist")) {
      throw new Error(licenseRes.error.message);
    }
  }

  const { data: billing } = await client
    .from("billing_accounts")
    .select("plan_key,status,current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  return buildLicenseEntitlements(licenseScopeFromBilling(billing as BillingRow | null));
}

export function defaultEnterpriseLicenseScope(tier: LicenseTier): LicenseScope {
  return {
    tier,
    status: "ACTIVE",
    protectedRevenueBand: "UNSET",
    unlimitedExecutiveAccess: tier === "BUSINESS" || tier === "ENTERPRISE" || tier === "STRATEGIC_ENTERPRISE",
    implementationMode: tier === "STRATEGIC_ENTERPRISE" ? "WHITE_GLOVE" : tier === "ENTERPRISE" ? "GUIDED" : "SELF_SERVE",
  };
}
