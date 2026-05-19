import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, resolveDefaultOrgForUser, assertOrgOwnerOrAdmin } from "@/lib/server/authz";
import { getOrgLicenseEntitlements } from "@/services/licensing";

export async function GET() {
  try {
    const ctx = await resolveDefaultOrgForUser();
    assertOrgOwnerOrAdmin(ctx);

    const admin = createAdminClient();
    const license = await getOrgLicenseEntitlements(admin, ctx.orgId);

    const { data: row } = await admin
      .from("organization_licenses")
      .select(
        "contract_start,contract_end,renewal_date,order_form_reference,account_manager_user_id,customer_success_owner_user_id"
      )
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      orgId: ctx.orgId,
      license: {
        tier: license.tier,
        status: license.status,
        protectedRevenueBand: license.protectedRevenueBand,
        implementationMode: license.implementationMode,
        unlimitedExecutiveAccess: license.unlimitedExecutiveAccess,
        includedAdminSeats: license.includedAdminSeats,
        licensedBusinessUnits: license.licensedBusinessUnits,
        licensedIntegrations: license.licensedIntegrations,
        licensedDomains: license.licensedDomains,
        premiumModules: license.premiumModules,
        capabilities: license.capabilities,
        contractStart: (row as { contract_start?: string | null } | null)?.contract_start ?? null,
        contractEnd: (row as { contract_end?: string | null } | null)?.contract_end ?? null,
        renewalDate: (row as { renewal_date?: string | null } | null)?.renewal_date ?? null,
        orderFormReference: (row as { order_form_reference?: string | null } | null)?.order_form_reference ?? null,
        accountManagerAssigned: Boolean((row as { account_manager_user_id?: string | null } | null)?.account_manager_user_id),
        customerSuccessOwnerAssigned: Boolean((row as { customer_success_owner_user_id?: string | null } | null)?.customer_success_owner_user_id),
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
