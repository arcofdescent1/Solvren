import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { Card, CardBody, CardHeader, CardTitle } from "@/ui/primitives/card";
import { PageHeader } from "@/ui/layout/page-header";
import JobRunnerPanel from "@/components/jobs/JobRunnerPanel";
import { AiUsageCard } from "@/components/admin/AiUsageCard";

export default async function AdminJobsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? null;
  if (!active?.orgId) redirect("/dashboard");
  if (!isAdminLikeRole(parseOrgRole(active.role ?? null))) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">Owner/Admin access required.</p>
        <Link href="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const orgId = active.orgId;
  const [
    { count: pendingCount },
    { count: processingCount },
    { count: failedCount },
    { data: latestOutbox },
    { data: latestSla },
  ] = await Promise.all([
    supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "PENDING"),
    supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "PROCESSING"),
    supabase
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "FAILED"),
    supabase
      .from("notification_outbox")
      .select("created_at, status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sla_events")
      .select("created_at, new_state")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Jobs"
        description="Operational visibility and manual triggers for background processors."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin Jobs", href: "/admin/jobs" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Outbox Pending</p>
            <p className="mt-1 text-2xl font-semibold">{pendingCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Outbox Processing</p>
            <p className="mt-1 text-2xl font-semibold">{processingCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Outbox Failed</p>
            <p className="mt-1 text-2xl font-semibold">{failedCount ?? 0}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        <AiUsageCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Job Signals</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p>
            Latest outbox row:{" "}
            {latestOutbox?.created_at ? new Date(latestOutbox.created_at).toLocaleString() : "—"}{" "}
            ({latestOutbox?.status ?? "—"})
          </p>
          <p>
            Latest SLA event:{" "}
            {latestSla?.created_at ? new Date(latestSla.created_at).toLocaleString() : "—"}{" "}
            ({latestSla?.new_state ?? "—"})
          </p>
          <p>
            Health endpoint:{" "}
            <Link href="/api/health" className="text-[var(--primary)] hover:underline">
              /api/health
            </Link>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Trigger</CardTitle>
        </CardHeader>
        <CardBody>
          <JobRunnerPanel orgId={orgId} />
        </CardBody>
      </Card>
    </div>
  );
}
