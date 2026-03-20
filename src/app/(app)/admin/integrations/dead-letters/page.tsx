/**
 * Phase 4 — Dead-letter queue UI (§19.3).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listDeadLetters } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { DeadLetterQueueClient } from "@/components/integrations/DeadLetterQueueClient";

export default async function DeadLetterQueuePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: deadLetters } = await listDeadLetters(supabase, activeOrgId, { status: "OPEN" }, 100);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Integration Reliability", href: "/admin/integrations/reliability" },
          { label: "Dead-letter queue" },
        ]}
        title="Dead-letter queue"
        description="Terminally failed or quarantined events/actions awaiting review."
        right={
          <Link href="/admin/integrations/reliability" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Reliability
          </Link>
        }
      />
      <DeadLetterQueueClient deadLetters={deadLetters ?? []} />
    </div>
  );
}
