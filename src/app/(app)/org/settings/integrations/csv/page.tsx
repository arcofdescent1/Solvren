/**
 * Phase 3 — CSV integration setup.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import CsvUploadWizard from "@/components/integrations/CsvUploadWizard";

export default async function CsvIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/org/settings/integrations");

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations", href: "/org/settings/integrations" },
            { label: "CSV Import" },
          ]}
          title="CSV Import"
          description="Upload CSV files to import data through the mapping pipeline."
          right={
            <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)]">
              ← Integrations
            </Link>
          }
        />
        <CsvUploadWizard orgId={activeOrgId} />
      </Stack>
    </div>
  );
}
