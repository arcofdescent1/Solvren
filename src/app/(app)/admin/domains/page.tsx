import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import DomainBuilderClient from "./ui/DomainBuilderClient";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function AdminDomainsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership || !isAdminLikeRole(parseOrgRole(membership.role ?? null))) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}
          title="Domain Builder"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--danger)]">Owner/Admin role required.</p>
            <Link href="/dashboard" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Domain Builder" },
        ]}
        title="Domain Builder"
        description="Manage domain templates: domains, SLA policies, signals, detectors, mitigations."
        right={
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            ← Dashboard
          </Link>
        }
      />

      <Card>
        <CardBody className="p-6">
          <DomainBuilderClient />
        </CardBody>
      </Card>
    </div>
  );
}
