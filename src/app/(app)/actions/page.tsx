import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPendingTasksForOrg } from "@/modules/execution/persistence/execution-tasks.repository";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { filterVisibleChanges, type ChangeVisibilityRow } from "@/lib/access/changeAccess";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Grid,
  PageHeaderV2,
  SectionHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/ui";
import { PageHelpDrawer } from "@/components/help";

type QueueItem = {
  id: string;
  source: "approval" | "issue" | "change" | "system";
  title: string;
  context: string;
  nextStep: string;
  href: string;
  owner: string;
  urgency: "critical" | "high" | "medium" | "low";
  dueLabel: string;
  sortScore: number;
};

type QueueChangeRow = ChangeVisibilityRow & {
  title: string | null;
  due_at: string | null;
  sla_status: string | null;
  updated_at: string | null;
};

function fmtDue(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

function urgencyVariant(urgency: QueueItem["urgency"]) {
  if (urgency === "critical") return "danger";
  if (urgency === "high") return "warning";
  if (urgency === "low") return "outline";
  return "secondary";
}

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

  const nowIso = new Date().toISOString();

  const [
    { data: tasks, error },
    { data: orgIssues },
    { data: pendingApprovals },
    { data: assignedIssues },
    changesResult,
  ] = await Promise.all([
    listPendingTasksForOrg(supabase, membership.org_id, 50),
    supabase.from("issues").select("id").eq("org_id", membership.org_id),
    supabase
      .from("approvals")
      .select("id, change_event_id, created_at")
      .eq("org_id", membership.org_id)
      .eq("approver_user_id", userRes.user.id)
      .eq("decision", "PENDING")
      .limit(50),
    supabase
      .from("issues")
      .select("id, issue_key, title, status, severity, owner_user_id, updated_at")
      .eq("org_id", membership.org_id)
      .eq("owner_user_id", userRes.user.id)
      .in("status", ["open", "triaged", "detected", "acknowledged", "assigned", "in_progress", "resolved", "reopened"])
      .limit(50),
    scopeActiveChangeEvents(
      supabase
        .from("change_events")
        .select("id, title, status, domain, due_at, sla_status, created_by, org_id, is_restricted, updated_at")
        .eq("org_id", membership.org_id)
        .in("status", ["DRAFT", "READY", "SUBMITTED", "IN_REVIEW"])
    ).limit(150),
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

  const visibleChanges = await filterVisibleChanges(
    supabase,
    userRes.user.id,
    (changesResult.data ?? []) as QueueChangeRow[]
  );
  const changeById = new Map(
    visibleChanges.map((change) => [
      String(change.id),
      change,
    ])
  );

  const queueItems: QueueItem[] = [];
  for (const approval of pendingApprovals ?? []) {
    const change = changeById.get(String(approval.change_event_id));
    if (!change) continue;
    queueItems.push({
      id: `approval-${approval.id}`,
      source: "approval",
      title: change.title ?? "Untitled change",
      context: "A revenue-impacting change is waiting for your decision.",
      nextStep: "Review and approve or request changes",
      href: `/changes/${change.id}#approvals`,
      owner: "You",
      urgency: change.due_at && change.due_at < nowIso ? "critical" : "high",
      dueLabel: fmtDue(change.due_at),
      sortScore: 1000 + (change.due_at && change.due_at < nowIso ? 300 : 0),
    });
  }

  for (const issue of assignedIssues ?? []) {
    const severity = String(issue.severity ?? "").toLowerCase();
    const high = severity === "high" || severity === "critical";
    const resolved = String(issue.status ?? "") === "resolved";
    queueItems.push({
      id: `issue-${issue.id}`,
      source: "issue",
      title: issue.title ?? issue.issue_key ?? "Untitled risk",
      context: resolved ? "This risk needs verification after resolution." : "A detected revenue risk is assigned to you.",
      nextStep: resolved ? "Verify outcome" : "Investigate or move resolution forward",
      href: `/issues/${issue.id}`,
      owner: "You",
      urgency: high ? "high" : "medium",
      dueLabel: "Open risk",
      sortScore: 700 + (high ? 200 : 0) + (resolved ? 80 : 0),
    });
  }

  for (const change of visibleChanges) {
    const status = String(change.status ?? "");
    const overdue = Boolean(change.due_at && change.due_at < nowIso) || change.sla_status === "ESCALATED";
    const needsDetails = status === "DRAFT" || status === "READY";
    if (!overdue && !needsDetails) continue;
    queueItems.push({
      id: `change-${change.id}`,
      source: "change",
      title: change.title ?? "Untitled change",
      context: needsDetails ? "This change needs intake details or evidence before review." : "This change is past its expected review window.",
      nextStep: needsDetails ? "Add missing details" : "Follow up on overdue review",
      href: `/changes/${change.id}${needsDetails ? "/intake?step=review" : ""}`,
      owner: change.created_by === userRes.user.id ? "You" : "Team",
      urgency: overdue ? "high" : "medium",
      dueLabel: fmtDue(change.due_at),
      sortScore: (overdue ? 650 : 450) + (change.created_by === userRes.user.id ? 120 : 0),
    });
  }

  for (const task of tasks) {
    queueItems.push({
      id: `system-${task.id}`,
      source: "system",
      title: task.issue_title ?? task.issue_key ?? "System follow-up",
      context: `${task.external_system} has a pending automated action.`,
      nextStep: task.status === "failed" ? "Retry or inspect failure" : "Monitor execution",
      href: `/issues/${task.issue_id}`,
      owner: task.assignee_ref ?? "System",
      urgency: task.status === "failed" ? "high" : "low",
      dueLabel: task.due_at ? fmtDue(task.due_at) : "System task",
      sortScore: task.status === "failed" ? 620 : 180,
    });
  }

  const sortedQueue = queueItems.sort((a, b) => b.sortScore - a.sortScore).slice(0, 100);
  const counts = {
    approvals: queueItems.filter((i) => i.source === "approval").length,
    risks: queueItems.filter((i) => i.source === "issue").length,
    blocked: queueItems.filter((i) => i.source === "change").length,
    system: queueItems.filter((i) => i.source === "system").length,
  };

  return (
    <Stack gap={6} className="flex flex-col">
      <PageHeaderV2
        title="Work Queue"
        description="One place for approvals, evidence requests, issue ownership, and operational follow-up."
        actions={
          <Link href="/insights/roi" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Impact and outcomes
          </Link>
        }
        helpTrigger={<PageHelpDrawer page="actions" />}
      />
      <Card className="border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_5%,var(--bg-surface)),var(--bg-surface)_70%)]">
        <CardBody>
          <Stack gap={3}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Start here</p>
              <h2 className="mt-1 text-lg font-semibold">Take the next clear action without decoding the system.</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Solvren keeps approvals, issues, notifications, and write-back tasks available, but this queue organizes them by what a person should do next.
              </p>
            </div>
            <Grid cols={1} gap={3} className="md:grid-cols-3">
              <Link href="/changes?view=needs-my-review" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface-2)]">
                <Stack direction="row" justify="between" align="center">
                  <div>
                    <p className="font-semibold">Review approvals</p>
                    <p className="text-sm text-[var(--text-muted)]">Changes waiting for your decision</p>
                  </div>
                  <Badge variant={counts.approvals > 0 ? "warning" : "secondary"}>{counts.approvals}</Badge>
                </Stack>
              </Link>
              <Link href="/issues?assignee=me" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface-2)]">
                <Stack direction="row" justify="between" align="center">
                  <div>
                    <p className="font-semibold">Resolve assigned risks</p>
                    <p className="text-sm text-[var(--text-muted)]">Investigations and fixes you own</p>
                  </div>
                  <Badge variant={counts.risks > 0 ? "warning" : "secondary"}>{counts.risks}</Badge>
                </Stack>
              </Link>
              <Link href="/changes?view=needs-details" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface-2)]">
                <Stack direction="row" justify="between" align="center">
                  <div>
                    <p className="font-semibold">Add missing details</p>
                    <p className="text-sm text-[var(--text-muted)]">Evidence and intake gaps blocking progress</p>
                  </div>
                  <Badge variant={counts.blocked > 0 ? "warning" : "secondary"}>{counts.blocked}</Badge>
                </Stack>
              </Link>
            </Grid>
          </Stack>
        </CardBody>
      </Card>

      <TableShell
        title="Prioritized work"
        helper="Approvals, assigned risks, blocked changes, overdue items, and system follow-up sorted by urgency."
        toolbar={
          <Button asChild variant="secondary" size="sm">
            <Link href="/changes?view=needs-my-review">Review decisions</Link>
          </Button>
        }
        empty={
          sortedQueue.length === 0 ? (
            <EmptyState
              variant="good_empty"
              title="No work needs attention right now"
              body="Approvals, assigned risks, blocked changes, and system follow-up will appear here when they need action."
            />
          ) : null
        }
      >
        {sortedQueue.length > 0 ? (
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Work item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedQueue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={item.href} className="font-semibold text-[var(--primary)] hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{item.context}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.source === "approval"
                        ? "Decision"
                        : item.source === "issue"
                        ? "Risk"
                        : item.source === "change"
                        ? "Change"
                        : "System"}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell className="text-[var(--text-muted)]">{item.dueLabel}</TableCell>
                  <TableCell>
                    <Badge variant={urgencyVariant(item.urgency)}>{item.urgency}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={item.href} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                      {item.nextStep}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </TableShell>

      <SectionHeader title="System follow-up" helper="Tasks Solvren can execute or retry through connected systems." />
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
              <EmptyState
                variant="good_empty"
                title="No pending tasks right now"
                body="No assigned or recommended action currently needs execution."
                action={
                  <Link href="/issues" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                    View issues
                  </Link>
                }
              />
            </Stack>
          </CardBody>
        </Card>
      ) : (
        <TableShell>
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
        </TableShell>
      )}
    </Stack>
  );
}
