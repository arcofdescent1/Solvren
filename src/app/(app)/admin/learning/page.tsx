/**
 * Phase 6 — Learning / calibration admin: drift, recommendation health, review queues.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { LearningAdminClient } from "@/components/learning/LearningAdminClient";

export default async function AdminLearningPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: "Learning" },
        ]}
        title="Learning & calibration"
        description="Decision quality signals, bounded calibration drafts, and suggestion review — recommendations only; governance still approves production changes."
        right={
          <Link href="/admin/policy/decisions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Decision logs →
          </Link>
        }
      />
      <Card>
        <CardBody>
          <LearningAdminClient />
        </CardBody>
      </Card>
    </div>
  );
}
