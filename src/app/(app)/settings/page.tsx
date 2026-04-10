import Link from "next/link";
import { Card, CardBody, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";
import { PageHelpDrawer } from "@/components/help";

const SETTINGS_LINKS = [
  {
    title: "Organization",
    href: "/settings/organization",
    description: "Name, profile, and organization-level defaults.",
  },
  {
    title: "Attention routing",
    href: "/settings/attention",
    description: "Who gets interrupted, revenue thresholds, and attention digests.",
  },
  {
    title: "Team & access",
    href: "/settings/users",
    description: "Manage who has access and what they can do.",
  },
  {
    title: "Policies & approvals",
    href: "/settings/policies",
    description: "Configure approval rules, mappings, and governance behavior.",
  },
  {
    title: "Notifications",
    href: "/notifications",
    description: "Inbox, digests, and delivery settings.",
  },
  {
    title: "Admin & diagnostics",
    href: "/settings/system/diagnostics",
    description: "Operational diagnostics and advanced troubleshooting.",
  },
];

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
      <SectionHeader title="Settings categories" helper="Use these areas to manage access, governance policy, notifications, and diagnostics." />

      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">{PAGE_COPY.settings.helper}</p>
        </CardBody>
      </Card>

      <Grid cols={3} gap={4}>
        {SETTINGS_LINKS.map((item) => (
          <Card key={item.href}>
            <CardBody className="space-y-2">
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="text-sm text-[var(--text-muted)]">{item.description}</p>
              <Link href={item.href} className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
                Open →
              </Link>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

