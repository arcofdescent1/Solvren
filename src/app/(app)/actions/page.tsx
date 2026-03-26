/**
 * Phase 6 — Action Center: pending write-back tasks across issues.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPendingTasksForOrg } from "@/modules/execution/persistence/execution-tasks.repository";
import { PageHeader, Card, CardBody, Grid, Stack, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";

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
    <Stack gap={6} className="flex flex-col">
      <PageHeader
        title={PAGE_COPY.actions.title}
        description={PAGE_COPY.actions.description}
        right={
          <Link href="/executive/roi" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ROI Dashboard →
          </Link>
        }
      />
      <p className="text-sm text-[var(--text-muted)]">{PAGE_COPY.actions.helper}</p>
      {actionStats.total > 0 && (
        <Grid cols={4} gap={3}>
          <Card>
            <CardBody>
              <Stack gap={1}>
                <p className="text-xs text-[var(--text-muted)]">Actions (7d)</p>
                <p className="text-lg font-semibold">{actionStats.total}</p>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stack gap={1}>
                <p className="text-xs text-[var(--text-muted)]">Success</p>
                <p className="text-lg font-semibold text-[var(--success)]">{actionStats.success}</p>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stack gap={1}>
                <p className="text-xs text-[var(--text-muted)]">Failed</p>
                <p className="text-lg font-semibold text-[var(--danger)]">{actionStats.failed}</p>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stack gap={1}>
                <p className="text-xs text-[var(--text-muted)]">Success rate</p>
                <p className="text-lg font-semibold">{actionStats.total > 0 ? Math.round((actionStats.success / actionStats.total) * 100) : 0}%</p>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
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
            <Stack gap={2}>
              <p className="text-sm text-[var(--text-muted)]">No pending tasks. Execute actions from issue detail pages.</p>
              <Link href="/issues" className="text-sm text-[var(--primary)] hover:underline inline-block">
                View issues →
              </Link>
            </Stack>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <Stack gap={4}>
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-[var(--border)] text-left">
                  <TableHead className="font-medium">Issue</TableHead>
                  <TableHead className="font-medium">Type</TableHead>
                  <TableHead className="font-medium">System</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <TableCell>
                      <Link href={`/issues/${t.issue_id}`} className="text-[var(--primary)] hover:underline">
                        {t.issue_key ?? t.issue_id.slice(0, 8)} — {t.issue_title ?? "Issue"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{String(t.task_type).split(".").pop() ?? t.task_type}</TableCell>
                    <TableCell>{t.external_system}</TableCell>
                    <TableCell>
                      <span className={t.status === "failed" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {new Date(t.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              <Link href="/issues" className="text-sm text-[var(--primary)] hover:underline inline-block">
                Browse issues →
              </Link>
            </Stack>
          </CardBody>
        </Card>
      )}
    </Stack>
  );
}
