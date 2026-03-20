/**
 * Phase 2 Gap 2 — Policy decision detail / trace viewer (§13).
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getDecisionLogById } from "@/modules/policy/repositories/policy-decision-logs.repository";

export default async function PolicyDecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: log } = await getDecisionLogById(supabase, id);
  if (!log || log.org_id !== activeOrgId) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center", href: "/admin/policy" },
          { label: "Decision logs", href: "/admin/policy/decisions" },
          { label: "Decision detail" },
        ]}
        title="Decision trace"
        description={`${log.action_key ?? log.playbook_key ?? "—"} · ${new Date(log.created_at).toLocaleString()}`}
        right={
          <Link href="/admin/policy/decisions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Decision logs
          </Link>
        }
      />

      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Result</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Final disposition</dt>
              <dd
                className={
                  log.final_disposition === "BLOCK"
                    ? "text-red-600 dark:text-red-400"
                    : log.final_disposition === "REQUIRE_APPROVAL"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                }
              >
                {log.final_disposition}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Reason code</dt>
              <dd>{log.decision_reason_code}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Effective mode</dt>
              <dd>{log.effective_autonomy_mode}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Action / Playbook</dt>
              <dd>{log.action_key ?? log.playbook_key ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{log.decision_message}</p>
        </CardBody>
      </Card>

      {(log.matched_rules_json as unknown[])?.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Matched rules</h3>
            <ul className="space-y-1 text-sm">
              {(log.matched_rules_json as Array<{ ruleKey?: string; policyKey?: string; effect?: string }>).map((r, i) => (
                <li key={i}>
                  {r.policyKey}/{r.ruleKey} → {r.effect}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {(log.blocked_rules_json as unknown[])?.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Blocked rules</h3>
            <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
              {(log.blocked_rules_json as Array<{ ruleKey?: string }>).map((r, i) => (
                <li key={i}>{r.ruleKey}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
