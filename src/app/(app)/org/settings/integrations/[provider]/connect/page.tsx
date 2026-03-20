/**
 * Phase 1 — Connect flow page. Shows value + permissions + starts OAuth via Phase 1 API.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getProviderManifest } from "@/modules/integrations/registry/getProviderManifest";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { PageHeader } from "@/ui";
import { IntegrationInstallFlow } from "@/components/integrations/IntegrationInstallFlow";

export default async function IntegrationConnectPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/org/settings/integrations");

  const { provider } = await params;
  if (!hasProvider(provider)) {
    redirect("/org/settings/integrations");
  }

  const manifest = getProviderManifest(provider);
  if (!manifest) redirect("/org/settings/integrations");

  const { data: account } = await getAccountByOrgAndProvider(supabase, activeOrgId, provider);
  if (account && account.status !== "disconnected" && account.status !== "not_installed") {
    redirect(`/org/settings/integrations/${provider}?connected=1`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Integrations", href: "/org/settings/integrations" },
          { label: manifest.displayName, href: `/org/settings/integrations/${provider}` },
          { label: "Connect" },
        ]}
        title={`Connect ${manifest.displayName}`}
        right={
          <Link href={`/org/settings/integrations/${provider}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Back
          </Link>
        }
      />
      <div className="mt-6">
        <IntegrationInstallFlow
          manifest={manifest}
          orgId={activeOrgId}
          onCancel={() => {}}
        />
      </div>
    </div>
  );
}
