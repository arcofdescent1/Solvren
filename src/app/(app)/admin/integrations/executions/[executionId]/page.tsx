/**
 * Phase 4 — Execution detail view (§19.2).
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getActionExecution } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";
import { listExecutionTargets } from "@/modules/integrations/reliability/repositories/integration-action-execution-targets.repository";
import { listReconciliationChecksForExecution } from "@/modules/integrations/reliability/repositories/integration-reconciliation-checks.repository";

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ executionId: string }>;
}) {
  const { executionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: execution } = await getActionExecution(supabase, executionId);
  if (!execution) notFound();
  if (execution.org_id !== activeOrgId) notFound();

  const [{ data: targets }, { data: reconChecks }] = await Promise.all([
    listExecutionTargets(supabase, executionId),
    listReconciliationChecksForExecution(supabase, executionId),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Integration Reliability", href: "/admin/integrations/reliability" },
          { label: "Executions", href: "/admin/integrations/executions" },
          { label: executionId.slice(0, 8) },
        ]}
        title={`Execution ${executionId.slice(0, 8)}`}
        description={`${execution.provider} · ${execution.action_key} · ${execution.execution_status}`}
        right={
          <Link href="/admin/integrations/executions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Executions
          </Link>
        }
      />
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Details</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-[var(--text-muted)]">Provider</dt><dd>{execution.provider}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Action</dt><dd className="font-mono">{execution.action_key}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Status</dt><dd>{execution.execution_status}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Attempts</dt><dd>{execution.attempt_count} / {execution.max_attempts}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Reconciliation</dt><dd>{execution.reconciliation_status}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Idempotency key</dt><dd className="font-mono text-xs">{execution.idempotency_key}</dd></div>
            {execution.last_error_message && (
              <div className="col-span-2">
                <dt className="text-[var(--text-muted)]">Last error</dt>
                <dd className="text-red-600 dark:text-red-400">{execution.last_error_message}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>
      {(targets ?? []).length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Targets</h3>
            <ul className="space-y-1 text-sm">
              {(targets ?? []).map((t) => (
                <li key={t.id} className="flex justify-between">
                  <span className="font-mono">{t.target_key}</span>
                  <span>{t.target_status}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      {(reconChecks ?? []).length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Reconciliation checks</h3>
            <ul className="space-y-1 text-sm">
              {(reconChecks ?? []).map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>{r.reconciliation_type}</span>
                  <span>{r.check_status}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
