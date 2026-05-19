import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOrgOwnerOrAdmin, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { getOrgLicenseEntitlements } from "@/services/licensing";
import { Card, CardBody, Grid, PageHeader, Stack } from "@/ui";

function fmt(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not set";
}

export default async function LicenseSettingsPage() {
  let ctx: Awaited<ReturnType<typeof resolveDefaultOrgForUser>>;
  try {
    ctx = await resolveDefaultOrgForUser();
    assertOrgOwnerOrAdmin(ctx);
  } catch {
    redirect("/settings");
  }

  const admin = createAdminClient();
  const license = await getOrgLicenseEntitlements(admin, ctx.orgId);
  const { data: row } = await admin
    .from("organization_licenses")
    .select("contract_start,contract_end,renewal_date,order_form_reference,account_manager_user_id,customer_success_owner_user_id")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const contract = row as {
    contract_start?: string | null;
    contract_end?: string | null;
    renewal_date?: string | null;
    order_form_reference?: string | null;
    account_manager_user_id?: string | null;
    customer_success_owner_user_id?: string | null;
  } | null;

  const enabledCapabilities = Object.entries(license.capabilities).filter(([, enabled]) => enabled);

  return (
    <Stack gap={6}>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "License" },
        ]}
        title="Solvren agreement"
        description="Your purchased package, protected revenue scope, rollout mode, and enabled enterprise capabilities."
      />

      <Grid cols={3} gap={4}>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Package</p>
            <p className="mt-1 text-xl font-semibold">{fmt(license.tier)}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Status: {fmt(license.status)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Protected revenue</p>
            <p className="mt-1 text-xl font-semibold">{fmt(license.protectedRevenueBand)}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Primary commercial scope for expansion.</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Rollout mode</p>
            <p className="mt-1 text-xl font-semibold">{fmt(license.implementationMode)}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Account manager: {contract?.account_manager_user_id ? "assigned" : "not assigned"}
            </p>
          </CardBody>
        </Card>
      </Grid>

      <Grid cols={2} gap={4}>
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Contract scope</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-[var(--text-muted)]">Contract dates</dt>
                <dd>{contract?.contract_start ?? "Not set"} to {contract?.contract_end ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Renewal date</dt>
                <dd>{contract?.renewal_date ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Business units</dt>
                <dd>{license.licensedBusinessUnits ?? "Not capped in app"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Executive access</dt>
                <dd>{license.unlimitedExecutiveAccess ? "Unlimited viewers and approvers" : "Limited by agreement"}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Licensed coverage</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[var(--text-muted)]">Domains</p>
                <p>{(license.licensedDomains ?? ["REVENUE"]).join(", ")}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Integrations</p>
                <p>{(license.licensedIntegrations ?? ["Core revenue systems"]).join(", ")}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Premium modules</p>
                <p>{license.premiumModules.length ? license.premiumModules.join(", ") : "None configured"}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </Grid>

      <Card>
        <CardBody>
          <h2 className="text-base font-semibold">Enabled capabilities</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {enabledCapabilities.length ? (
              enabledCapabilities.map(([capability]) => (
                <span key={capability} className="rounded-md border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm">
                  {fmt(capability)}
                </span>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No paid capabilities are enabled yet.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Expansion path</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Expand by protected revenue band, business-unit coverage, advanced security, integrations, or board-ready reporting.
            </p>
          </div>
          <Link href="/support" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Contact Solvren
          </Link>
        </CardBody>
      </Card>
    </Stack>
  );
}
