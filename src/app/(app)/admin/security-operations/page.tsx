/**
 * Phase 4 — Security posture visibility (§11).
 * Internal dashboard: control health, recent incidents, open remediation,
 * integration health, last backup validation, last access review.
 */
import { redirect } from "next/navigation";
import { DOCS_EDIT_BASE_URL } from "@/lib/docs/docConfig";

function getDocsViewBase(): string {
  return DOCS_EDIT_BASE_URL.replace(/\/edit\/main\/?$/, "/blob/main/");
}
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getLatestConnectorHealth } from "@/modules/integrations/reliability/repositories/connector-health-snapshots.repository";
import { listDeadLetters } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { getSecurityPostureSummary } from "@/lib/security/posture-summary";
import { Shield, AlertTriangle, Activity, Database, Users, Server } from "lucide-react";

export default async function SecurityOperationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const [postureSummary, integrationData] = await Promise.all([
    getSecurityPostureSummary(),
    (async () => {
      const { data: accounts } = await getAccountsByOrg(supabase, activeOrgId);
      const healthData = await Promise.all(
        (accounts ?? []).map(async (a) => {
          const { data: snap } = await getLatestConnectorHealth(supabase, a.id);
          return {
            id: a.id,
            provider: a.provider,
            displayName: a.display_name,
            healthState: snap?.health_state ?? "HEALTHY",
            lastSuccessAt: a.last_success_at,
            lastErrorAt: a.last_error_at,
          };
        })
      );
      const { data: deadLetters } = await listDeadLetters(supabase, activeOrgId, { status: "OPEN" }, 10);
      const unhealthyCount = healthData.filter((h) => h.healthState !== "HEALTHY").length;
      return { healthData, deadLetterCount: deadLetters?.length ?? 0, unhealthyCount };
    })(),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Security Operations" },
        ]}
        title="Security Operations"
        description="Control health, incidents, remediation, integration reliability, and evidence status."
        right={
          <div className="flex items-center gap-3">
            <Link href="/trust" className="text-sm font-semibold text-[var(--primary)] hover:underline" target="_blank">
              Trust Center →
            </Link>
            <Link href="/admin/org-purge" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Org purge
            </Link>
            <Link href="/admin/domains" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Admin
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Control health</h3>
                <p className="text-xs text-[var(--text-muted)]">Phase 3 control status</p>
              </div>
            </div>
            <Link
              href="https://github.com/your-org/revenueguard/blob/main/docs/security/control-health-register.md"
              className="mt-3 block text-sm font-medium text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View control health register →
            </Link>
            {postureSummary.controlHealthNote && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">{postureSummary.controlHealthNote}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Open remediation</h3>
                <p className="text-xs text-[var(--text-muted)]">Security gaps & control failures</p>
              </div>
            </div>
            <a
              href={`${getDocsViewBase()}docs/security/security-remediation-register.md`}
              className="mt-3 block text-sm font-medium text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View remediation register →
            </a>
            {postureSummary.openRemediationCount !== undefined && postureSummary.openRemediationCount > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                {postureSummary.openRemediationCount} open item{postureSummary.openRemediationCount !== 1 ? "s" : ""}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Recent incidents</h3>
                <p className="text-xs text-[var(--text-muted)]">SEV-1/2/3 writeups</p>
              </div>
            </div>
            <a
              href={`${getDocsViewBase()}docs/security/evidence/incidents/`}
              className="mt-3 block text-sm font-medium text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View incident evidence →
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Last backup validation</h3>
                <p className="text-xs text-[var(--text-muted)]">Monthly backup check</p>
              </div>
            </div>
            {postureSummary.lastBackupValidation ? (
              <p className="mt-3 text-sm text-[var(--text)]">{postureSummary.lastBackupValidation}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">See evidence/backups</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Last access review</h3>
                <p className="text-xs text-[var(--text-muted)]">Production/admin access</p>
              </div>
            </div>
            {postureSummary.lastAccessReview ? (
              <p className="mt-3 text-sm text-[var(--text)]">{postureSummary.lastAccessReview}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">See evidence/access-reviews</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Integration health</h3>
                <p className="text-xs text-[var(--text-muted)]">Connector status & dead letters</p>
              </div>
            </div>
            <Link href="/admin/integrations/reliability" className="mt-3 block text-sm font-medium text-[var(--primary)] hover:underline">
              Integration reliability →
            </Link>
            {integrationData.unhealthyCount > 0 && (
              <p className="mt-2 text-xs text-amber-600">{integrationData.unhealthyCount} unhealthy connector(s)</p>
            )}
            {integrationData.deadLetterCount > 0 && (
              <p className="mt-1 text-xs text-amber-600">{integrationData.deadLetterCount} open dead letter(s)</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Documentation & evidence</h3>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link
              href="/trust"
              className="font-medium text-[var(--primary)] hover:underline"
              target="_blank"
            >
              Trust Center (customer-facing)
            </Link>
            <Link
              href="/security"
              className="font-medium text-[var(--primary)] hover:underline"
              target="_blank"
            >
              Security overview
            </Link>
            <a
              href={`${getDocsViewBase()}docs/security/`}
              className="font-medium text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/security
            </a>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
