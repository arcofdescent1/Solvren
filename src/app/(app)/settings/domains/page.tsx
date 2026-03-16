import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader, Card, CardBody } from "@/ui";
import DomainSettingsClient from "./ui/DomainSettingsClient";

export default async function DomainSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}
          title="Domain Settings"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">No organization found for your account.</p>
            <Link href="/dashboard" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Back to dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Domains" },
        ]}
        title="Domain Settings"
        description="Enable domains, set SLA policy per domain, and tune signal weights."
        right={
          <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Org settings
          </Link>
        }
      />
      <DomainSettingsClient />
    </div>
  );
}
