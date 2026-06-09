import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Cable, HeartPulse, ShieldCheck, UserPlus } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge, Button, Card, CardBody, Grid, PageActionBar, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { PRODUCT_TERMS } from "@/config/productLanguage";

type IntegrationRow = {
  provider: string | null;
  status: string | null;
  last_error_message: string | null;
  last_success_at: string | null;
};

const CORE_SYSTEMS = [
  { key: "stripe", label: "Stripe", protection: "Billing protection" },
  { key: "salesforce", label: "Salesforce", protection: "Pipeline protection" },
  { key: "hubspot", label: "HubSpot", protection: "Customer journey protection" },
  { key: "slack", label: "Slack", protection: "Decision alerts" },
] as const;

const SETUP_STEPS = [
  {
    title: "Connect systems",
    body: "Start with the systems that touch billing, CRM, support, engineering, and customer changes.",
    href: "/org/settings/integrations",
    icon: Cable,
  },
  {
    title: "Choose what to protect",
    body: "Tell Solvren which revenue workflows matter most: billing, pricing, renewals, access, or customer handoffs.",
    href: "/settings/domains",
    icon: ShieldCheck,
  },
  {
    title: "Invite decision makers",
    body: "Add the people who approve changes, own problems, and need proof when revenue is at stake.",
    href: "/settings/users",
    icon: UserPlus,
  },
  {
    title: "See first risk/value",
    body: "Review the first detected problem, decision, or proof story so the value becomes obvious.",
    href: "/home",
    icon: BadgeCheck,
  },
] as const;

const ADVANCED_LINKS = [
  {
    title: "System connections",
    href: "/org/settings/integrations",
    description: "Reconnect providers, check authentication, and manage live connections.",
  },
  {
    title: "Object mappings",
    href: "/integrations/mappings",
    description: "Map external objects to Solvren customers, decisions, problems, and revenue workflows.",
  },
  {
    title: "Integration marketplace",
    href: "/marketplace/integrations",
    description: "Add more systems as protection coverage expands.",
  },
  {
    title: "Decision rules",
    href: "/settings/policies",
    description: "Tune which decisions need approval and proof.",
  },
  {
    title: "Security and data",
    href: "/settings/security",
    description: "Manage privacy mode, write-back defaults, and support access.",
  },
  {
    title: "Diagnostics",
    href: "/settings/system/diagnostics",
    description: "Advanced troubleshooting for admins.",
  },
] as const;

function providerLabel(provider: string | null) {
  if (!provider) return "Unknown system";
  return provider
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function systemStatus(system: (typeof CORE_SYSTEMS)[number], rows: IntegrationRow[]) {
  const row = rows.find((item) => item.provider?.toLowerCase() === system.key);
  if (!row) {
    return {
      label: `${system.label} not connected`,
      helper: `${system.protection} is not active yet.`,
      tone: "secondary" as const,
    };
  }
  if (row.last_error_message || row.status === "degraded" || row.status === "error") {
    return {
      label: `${system.label} needs attention`,
      helper: row.last_error_message ?? `${system.protection} may be incomplete.`,
      tone: "warning" as const,
    };
  }
  if (row.status === "connected") {
    return {
      label: `${system.label} connected`,
      helper: `${system.protection} is active.`,
      tone: "success" as const,
    };
  }
  return {
    label: `${system.label} pending`,
    helper: `${system.protection} is being set up.`,
    tone: "secondary" as const,
  };
}

export default async function IntegrationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");

  const { data: integrations } = await supabase
    .from("integration_accounts")
    .select("provider, status, last_error_message, last_success_at")
    .eq("org_id", membership.org_id);

  const rows = (integrations ?? []) as IntegrationRow[];
  const connectedCount = rows.filter((row) => row.status === "connected" && !row.last_error_message).length;
  const needsAttentionCount = rows.filter((row) => row.last_error_message || row.status === "degraded" || row.status === "error").length;
  const activeProtectionCount = CORE_SYSTEMS.filter((system) => systemStatus(system, rows).tone === "success").length;

  return (
    <Stack gap={8}>
      <PageHeaderV2
        breadcrumbs={[{ label: PRODUCT_TERMS.setup.title }]}
        title={PRODUCT_TERMS.setup.title}
        description="Get Solvren working quickly: connect systems, choose what to protect, invite decision makers, and see the first risk or proof of value."
        helper="Setup should feel like turning on protection, not configuring an enterprise maze."
      />

      <PageActionBar
        ariaLabel="Setup sections"
        items={[
          { label: "Journey", href: "#journey" },
          { label: "Coverage", href: "#coverage" },
          { label: "Advanced", href: "#advanced" },
        ]}
        actions={
          <>
            <Button asChild size="md">
              <Link href="/org/settings/integrations">
                Connect a system
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href="/settings/users">Invite people</Link>
            </Button>
          </>
        }
      />

      <section id="journey" className="scroll-mt-28 rounded-[var(--radius-xl)] border border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_8%,var(--bg-surface)),var(--bg-surface)_58%,color-mix(in_oklab,var(--success)_7%,var(--bg-surface)))] p-5 shadow-sm sm:p-7">
        <Stack gap={6}>
          <div className="max-w-3xl">
            <Badge variant="outline">Guided setup</Badge>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text)]">
              Four steps to make revenue protection visible.
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
              Solvren gets valuable as soon as it can see a revenue workflow, knows who decides, and has enough proof to show a first risk or value story.
            </p>
          </div>

          <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-4">
            {SETUP_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.title}
                  href={step.href}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition hover:border-[var(--primary)]/40 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Step {index + 1}</p>
                  <h3 className="mt-1 font-semibold text-[var(--text)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.body}</p>
                </Link>
              );
            })}
          </Grid>
        </Stack>
      </section>

      <section id="coverage" className="scroll-mt-28 space-y-3">
        <SectionHeader
          title="Coverage health"
          helper="Plain-language status for the systems that make Solvren useful."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/org/settings/integrations">Manage systems</Link>
            </Button>
          }
        />
        <Grid cols={1} gap={4} className="lg:grid-cols-[0.75fr_1.25fr]">
          <Card className="shadow-sm">
            <CardBody>
              <Stack gap={4}>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Protection coverage</p>
                  <p className="mt-1 text-3xl font-semibold">{activeProtectionCount}/{CORE_SYSTEMS.length}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">core protection areas active</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Connected</p>
                    <p className="mt-1 text-xl font-semibold">{connectedCount}</p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Needs attention</p>
                    <p className="mt-1 text-xl font-semibold">{needsAttentionCount}</p>
                  </div>
                </div>
              </Stack>
            </CardBody>
          </Card>

          <Grid cols={1} gap={3} className="md:grid-cols-2">
            {CORE_SYSTEMS.map((system) => {
              const status = systemStatus(system, rows);
              return (
                <Card key={system.key} className="shadow-sm">
                  <CardBody>
                    <Stack direction="row" justify="between" gap={3} align="start">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{status.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{status.helper}</p>
                      </div>
                      <Badge variant={status.tone}>{status.tone === "success" ? "Active" : status.tone === "warning" ? "Fix" : "Set up"}</Badge>
                    </Stack>
                  </CardBody>
                </Card>
              );
            })}
          </Grid>
        </Grid>
      </section>

      <Card className="shadow-sm">
        <CardBody>
          <SectionHeader title="What Solvren protects" helper="Choose business outcomes first. Advanced configuration can wait." />
          <Grid cols={1} gap={3} className="md:grid-cols-3">
            {[
              ["Billing protection", "Find failed charges, plan mismatches, proration risk, and renewal leakage."],
              ["Change protection", "Review releases, pricing changes, automation changes, and routing updates before they create revenue risk."],
              ["Customer protection", "Spot customer-impacting issues across CRM, support, entitlement, and lifecycle handoffs."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                <HeartPulse className="h-5 w-5 text-[var(--primary)]" aria-hidden />
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{body}</p>
              </div>
            ))}
          </Grid>
        </CardBody>
      </Card>

      <section id="advanced" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Advanced setup" helper="Everything is still available, grouped behind the setup journey." />
        <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-3">
          {ADVANCED_LINKS.map((item) => (
            <Card key={item.href} className="shadow-sm">
              <CardBody className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>
                </div>
                <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline">
                  Open <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </CardBody>
            </Card>
          ))}
        </Grid>
      </section>

      {rows.length > 0 ? (
        <details className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
          <summary className="cursor-pointer px-[var(--card-spacer-x)] py-[var(--card-spacer-y)] font-semibold">
            Technical connection details
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">Provider status and last healthy sync.</span>
          </summary>
          <div className="space-y-2 border-t border-[var(--border)] p-[var(--card-spacer-x)]">
            {rows.map((row) => (
              <div key={`${row.provider}-${row.last_success_at ?? "none"}`} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{providerLabel(row.provider)}</span>
                  <span className="text-[var(--text-muted)]">{row.status ?? "unknown"}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {row.last_error_message
                    ? row.last_error_message
                    : row.last_success_at
                      ? `Last healthy sync ${new Date(row.last_success_at).toLocaleString()}`
                      : "No sync recorded yet"}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </Stack>
  );
}
