import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge, Card, CardBody, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";

type McpPolicyProfile = {
  id: string;
  profile_key: string;
  profile_name: string;
  status: string;
  purpose: string | null;
  allowed_tools: string[] | null;
  allowed_mutations: string[] | null;
  allowed_roles: string[] | null;
  allowed_email_domains: string[] | null;
  max_result_limit: number | null;
  require_confirmation: boolean | null;
  action_ttl_minutes: number | null;
  redaction_level: string | null;
  audit_level: string | null;
  updated_at: string | null;
};

type McpAuditEvent = {
  id: string;
  action_type: string | null;
  event_type: string | null;
  status: string | null;
  actor_email: string | null;
  caller_label: string | null;
  reason: string | null;
  created_at: string | null;
};

function formatCount(value: string[] | null | undefined, fallback: string) {
  if (!value || value.length === 0) return fallback;
  return `${value.length}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function AuditIcon({ status }: { status: string | null }) {
  if (status === "EXECUTED") return <CheckCircle2 size={16} className="text-[var(--success)]" aria-hidden="true" />;
  if (status === "FAILED" || status === "REJECTED") return <XCircle size={16} className="text-[var(--danger)]" aria-hidden="true" />;
  return <Clock3 size={16} className="text-[var(--text-muted)]" aria-hidden="true" />;
}

export default async function McpSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to home
        </Link>
      </Stack>
    );
  }

  const canManage = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  const [profilesResult, auditResult] = await Promise.all([
    supabase
      .from("mcp_policy_profiles")
      .select("id, profile_key, profile_name, status, purpose, allowed_tools, allowed_mutations, allowed_roles, allowed_email_domains, max_result_limit, require_confirmation, action_ttl_minutes, redaction_level, audit_level, updated_at")
      .eq("org_id", activeOrgId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("mcp_action_audit_log")
      .select("id, action_type, event_type, status, actor_email, caller_label, reason, created_at")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const profiles = (profilesResult.data ?? []) as McpPolicyProfile[];
  const auditEvents = (auditResult.data ?? []) as McpAuditEvent[];
  const hasMissingMigration = Boolean(profilesResult.error || auditResult.error);

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[
          { label: "Setup", href: "/integrations" },
          { label: "Organization setup", href: "/settings" },
          { label: "MCP assistant access" },
        ]}
        title="MCP assistant access"
        description="Review which assistants can read, draft, prepare, and confirm Solvren actions."
        helper="Environment guardrails remain the outer boundary. Customer policy profiles make the allowed access visible and reviewable."
      />

      {hasMissingMigration ? (
        <Card className="border-[var(--warning)]/40 bg-[color-mix(in_oklab,var(--warning)_8%,var(--bg-surface))]">
          <CardBody>
            <h2 className="text-base font-semibold">MCP policy tables are not available yet</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Apply the latest database migrations to show assistant policy profiles and MCP action audit history.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Grid cols={4} gap={4}>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Policy profiles</p>
            <p className="mt-2 text-2xl font-semibold">{profiles.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Active profiles</p>
            <p className="mt-2 text-2xl font-semibold">{profiles.filter((profile) => profile.status === "active").length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Recent MCP events</p>
            <p className="mt-2 text-2xl font-semibold">{auditEvents.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Policy edits</p>
            <p className="mt-2 text-2xl font-semibold">{canManage ? "Service" : "Restricted"}</p>
          </CardBody>
        </Card>
      </Grid>

      <section className="space-y-3">
        <SectionHeader title="Assistant policy profiles" helper="Profiles define what each deployed assistant can access for this organization." />
        {profiles.length === 0 ? (
          <Card>
            <CardBody className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--primary)]">
                <Bot size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">No customer policy profiles yet</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  MCP will fall back to environment guardrails until a customer profile is created for this assistant key.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Grid cols={2} gap={4}>
            {profiles.map((profile) => (
              <Card key={profile.id}>
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold">{profile.profile_name}</h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{profile.purpose ?? profile.profile_key}</p>
                    </div>
                    <Badge variant={profile.status === "active" ? "success" : "secondary"}>{profile.status}</Badge>
                  </div>
                  <Grid cols={3} gap={3}>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Tools</p>
                      <p className="mt-1 text-sm font-semibold">{formatCount(profile.allowed_tools, "Environment")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Actions</p>
                      <p className="mt-1 text-sm font-semibold">{formatCount(profile.allowed_mutations, "None")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Result limit</p>
                      <p className="mt-1 text-sm font-semibold">{profile.max_result_limit ?? 50}</p>
                    </div>
                  </Grid>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                    <p>
                      Confirmation is <span className="font-semibold">{profile.require_confirmation ? "required" : "not required"}</span>; prepared actions expire in{" "}
                      <span className="font-semibold">{profile.action_ttl_minutes ?? 10} minutes</span>.
                    </p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Redaction: {profile.redaction_level ?? "standard"} · Audit: {profile.audit_level ?? "metadata"}
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </Grid>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Recent assistant action audit" helper="Prepared, confirmed, rejected, failed, and executed MCP actions." />
        <Card>
          <CardBody className="space-y-3">
            {auditEvents.length === 0 ? (
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--primary)]">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">No controlled MCP actions yet</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Read-only and draft tools can still be used; controlled writes appear here after prepare or confirm attempts.</p>
                </div>
              </div>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
                  <div className="flex items-start gap-3">
                    <AuditIcon status={event.status} />
                    <div>
                      <p className="text-sm font-semibold">{event.action_type ?? "MCP action"}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {event.event_type ?? "event"} · {event.status ?? "unknown"} · {event.actor_email ?? event.caller_label ?? "assistant"}
                      </p>
                      {event.reason ? <p className="mt-1 text-xs text-[var(--danger)]">{event.reason}</p> : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-[var(--text-muted)]">{formatDate(event.created_at)}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>
    </Stack>
  );
}
