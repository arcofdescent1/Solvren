/**
 * Phase 6 — Action Center: pending write-back tasks across issues.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPendingTasksForOrg } from "@/modules/execution/persistence/execution-tasks.repository";
import { PageHeader, Card, CardBody } from "@/ui";

export default async function ActionCenterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");

  const [{ data: tasks, error }, { data: orgIssues }] = await Promise.all([
    listPendingTasksForOrg(supabase, membership.org_id, 50),
    supabase.from("issues").select("id").eq("org_id", membership.org_id),
  ]);

  const issueIds = (orgIssues ?? []).map((i: { id: string }) => i.id);
  let actionStats = { total: 0, success: 0, failed: 0 };
  if (issueIds.length > 0) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: actionRows } = await supabase
      .from("issue_actions")
      .select("action_status")
      .in("issue_id", issueIds)
      .gte("created_at", since.toISOString());
    const rows = (actionRows ?? []) as Array<{ action_status: string }>;
    actionStats = {
      total: rows.length,
      success: rows.filter((r) => r.action_status === "done").length,
      failed: rows.filter((r) => r.action_status === "failed").length,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Action Center"
        description="DETECT → QUANTIFY → ROUTE → EXECUTE → VERIFY. Pending write-back tasks and execution metrics."
        right={
          <Link href="/executive/roi" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ROI Dashboard →
          </Link>
        }
      />
      {actionStats.total > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardBody className="py-3">
              <p className="text-xs text-[var(--text-muted)]">Actions (7d)</p>
              <p className="text-lg font-semibold">{actionStats.total}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <p className="text-xs text-[var(--text-muted)]">Success</p>
              <p className="text-lg font-semibold text-[var(--success)]">{actionStats.success}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <p className="text-xs text-[var(--text-muted)]">Failed</p>
              <p className="text-lg font-semibold text-[var(--danger)]">{actionStats.failed}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <p className="text-xs text-[var(--text-muted)]">Success rate</p>
              <p className="text-lg font-semibold">{actionStats.total > 0 ? Math.round((actionStats.success / actionStats.total) * 100) : 0}%</p>
            </CardBody>
          </Card>
        </div>
      )}
      {error ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--danger)]">Failed to load tasks: {error.message}</p>
          </CardBody>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">No pending tasks. Execute actions from issue detail pages.</p>
            <Link href="/issues" className="text-sm text-[var(--primary)] hover:underline mt-2 inline-block">
              View issues →
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="py-2 pr-4 font-medium">Issue</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">System</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/issues/${t.issue_id}`} className="text-[var(--primary)] hover:underline">
                        {t.issue_key ?? t.issue_id.slice(0, 8)} — {t.issue_title ?? "Issue"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{String(t.task_type).split(".").pop() ?? t.task_type}</td>
                    <td className="py-2 pr-4">{t.external_system}</td>
                    <td className="py-2 pr-4">
                      <span className={t.status === "failed" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-muted)]">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href="/issues" className="text-sm text-[var(--primary)] hover:underline mt-4 inline-block">
              Browse issues →
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
