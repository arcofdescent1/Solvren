/**
 * Phase 1 — Stripe integration detail (placeholder).
 * Connect and health via Phase 1 platform when implemented.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";

export default async function StripeIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/org/settings/integrations");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Integrations", href: "/org/settings/integrations" },
          { label: "Stripe" },
        ]}
        title="Stripe"
        description="Identify failed payment patterns and at-risk subscription revenue."
      />
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">
            Stripe integration setup will be available here. Connect your Stripe account to sync customers, subscriptions, and payment events.
          </p>
          <Link
            href="/org/settings/integrations"
            className="mt-4 inline-block text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            ← Back to Integrations
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
