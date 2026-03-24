/**
 * Phase 4 — Integration marketplace: discover and install connectors.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { getRegistryManifest, hasProvider, INTEGRATION_PROVIDERS_PHASE1, INTEGRATION_PROVIDERS_PHASE3 } from "@/modules/integrations/registry/providerRegistry";

export default async function MarketplaceIntegrationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/org/settings/integrations");

  const allProviders = [...INTEGRATION_PROVIDERS_PHASE1, ...INTEGRATION_PROVIDERS_PHASE3];
  const manifests = allProviders
    .filter((p) => hasProvider(p))
    .map((p) => {
      try {
        return getRegistryManifest(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Marketplace", href: "/marketplace" },
          { label: "Integrations" },
        ]}
        title="Integration Marketplace"
        description="Discover and install connectors for your data stack."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifests.map((m) => (
          <Card key={m!.provider}>
            <CardBody>
              <h3 className="font-semibold">{m!.displayName}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{m!.description}</p>
              <Link
                href={`/org/settings/integrations/${m!.provider}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Configure →
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
