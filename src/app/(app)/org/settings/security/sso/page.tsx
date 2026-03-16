import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import SsoIntegrationCard from "@/components/security/SsoIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SsoSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "SSO", href: "/org/settings/security/sso" },
          ]}
          title="SSO / Enterprise Identity"
          description="Configure single sign-on using Okta, Google, Entra ID, or custom OIDC/SAML."
          right={
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Org settings
            </Link>
          }
        />
        <SsoIntegrationCard orgId={activeOrgId} isAdmin={isAdmin} />
      </Stack>
    </div>
  );
}
