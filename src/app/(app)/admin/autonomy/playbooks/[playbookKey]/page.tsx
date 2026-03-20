/**
 * Phase 8 — Playbook detail page.
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody, Stack } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getPlaybookDefinitionByKey, getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ playbookKey: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { playbookKey } = await params;
  const { data: playbook } = await getPlaybookDefinitionByKey(supabase, playbookKey);
  if (!playbook) notFound();

  const { data: configs } = await getOrgPlaybookConfigs(supabase, activeOrgId);
  const config = configs?.find((c) => c.playbook_definition_id === playbook.id);
  const steps = (playbook.steps_json ?? []) as Array<{ key: string; type: string; actionKey?: string; order: number }>;

  return (
    <Stack gap={6} className="max-w-4xl">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Playbooks", href: "/admin/autonomy/playbooks" },
          { label: playbook.display_name },
        ]}
        title={playbook.display_name}
        description={playbook.description}
        right={
          <Link href="/admin/autonomy/playbooks" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Catalog
          </Link>
        }
      />

      <Card>
        <CardBody>
          <Stack gap={1}>
            <h2 className="text-lg font-semibold">Configuration</h2>
            <p className="text-sm text-[var(--text-muted)]">
            Status: {config?.enabled ? "Enabled" : "Disabled"} · Rollout: {config?.rollout_state ?? "off"}
            </p>
            <Link
              href="/admin/autonomy/playbooks"
              className="inline-block text-sm font-medium text-[var(--primary)] hover:underline"
            >
            Configure in catalog →
            </Link>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap={2}>
            <h2 className="text-lg font-semibold">Workflow steps</h2>
            <ul className="flex flex-col gap-2">
            {steps
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-[var(--text-muted)]">{s.type}</span>
                  <span>{s.key}</span>
                  {s.actionKey && (
                    <span className="text-xs text-[var(--text-muted)]">→ {s.actionKey}</span>
                  )}
                </li>
              ))}
            </ul>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Stack gap={1}>
            <h2 className="text-lg font-semibold">Required integrations</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {(playbook.required_integrations_json as string[])?.join(", ") ?? "—"}
            </p>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
