import Link from "next/link";
import { ArrowRight, Bell, Building2, ClipboardCheck, Handshake, LockKeyhole, Route, Settings2, Users } from "lucide-react";
import { Card, CardBody, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";
import { PageHelpDrawer } from "@/components/help";

const SETTINGS_LINKS = [
  {
    title: "Organization",
    href: "/settings/organization",
    description: "Name, profile, and organization-level defaults.",
    group: "Account setup",
    icon: Building2,
  },
  {
    title: "Team & access",
    href: "/settings/users",
    description: "Manage who has access and what they can do.",
    group: "Account setup",
    icon: Users,
  },
  {
    title: "Security & data protection",
    href: "/settings/security",
    description: "Privacy mode, write-back defaults, integration scope, and support access.",
    group: "Account setup",
    icon: LockKeyhole,
  },
  {
    title: "License & agreement",
    href: "/settings/license",
    description: "Package, protected revenue scope, enterprise modules, and rollout details.",
    group: "Account setup",
    icon: Handshake,
  },
  {
    title: "Policies & approvals",
    href: "/settings/policies",
    description: "Configure approval rules, mappings, and governance behavior.",
    group: "Workflow behavior",
    icon: ClipboardCheck,
  },
  {
    title: "Attention routing",
    href: "/settings/attention",
    description: "Who gets interrupted, revenue thresholds, and attention digests.",
    group: "Workflow behavior",
    icon: Route,
  },
  {
    title: "Notifications",
    href: "/notifications",
    description: "Inbox, digests, and delivery settings.",
    group: "Workflow behavior",
    icon: Bell,
  },
  {
    title: "Admin & diagnostics",
    href: "/settings/system/diagnostics",
    description: "Operational diagnostics and advanced troubleshooting.",
    group: "Advanced",
    icon: Settings2,
  },
];

const SETTINGS_GROUPS = [
  {
    title: "Account setup",
    helper: "Identity, access, security, and organization defaults.",
  },
  {
    title: "Workflow behavior",
    helper: "Approval policy, attention routing, and notification controls.",
  },
  {
    title: "Advanced",
    helper: "Diagnostics and support tools for admins.",
  },
] as const;

export default function SettingsLandingPage() {
  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Settings" }]}
        title={PAGE_COPY.settings.title}
        description={PAGE_COPY.settings.description}
        helper={PAGE_COPY.settings.helper}
        helpTrigger={<PageHelpDrawer page="settings" />}
      />

      <Card className="border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_4%,var(--bg-surface)),var(--bg-surface)_72%)]">
        <CardBody className="grid gap-4 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Recommended path</p>
            <h2 className="mt-1 text-lg font-semibold">Configure Solvren from business controls to operations.</h2>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold">1. Account</p>
              <p className="text-[var(--text-muted)]">Set organization, access, and security defaults.</p>
            </div>
            <div>
              <p className="font-semibold">2. Workflow</p>
              <p className="text-[var(--text-muted)]">Tune approvals, routing, and notifications.</p>
            </div>
            <div>
              <p className="font-semibold">3. Operations</p>
              <p className="text-[var(--text-muted)]">Use diagnostics when something needs deeper follow-up.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <SectionHeader title="Settings categories" helper="Every control remains available, grouped by the job it supports." />

      <Stack gap={4}>
        {SETTINGS_GROUPS.map((group) => {
          const links = SETTINGS_LINKS.filter((item) => item.group === group.title);
          return (
            <section key={group.title} className="space-y-3">
              <SectionHeader title={group.title} helper={group.helper} />
              <Grid cols={3} gap={4}>
                {links.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.href}>
                      <CardBody className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--primary)]">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <div>
                            <h2 className="text-sm font-semibold">{item.title}</h2>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p>
                          </div>
                        </div>
                        <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline">
                          Open <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </CardBody>
                    </Card>
                  );
                })}
              </Grid>
            </section>
          );
        })}
      </Stack>
    </Stack>
  );
}
