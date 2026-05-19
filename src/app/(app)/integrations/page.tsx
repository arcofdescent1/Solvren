import Link from "next/link";
import { ArrowRight, Boxes, Cable, Map } from "lucide-react";
import { Card, CardBody, Grid, PageHeaderV2, SectionHeader, Stack } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";
import { PageHelpDrawer } from "@/components/help";

const INTEGRATION_LINKS = [
  {
    title: "Connected systems",
    href: "/org/settings/integrations",
    description: "Manage live connections, reconnect broken providers, and confirm monitoring health.",
    icon: Cable,
  },
  {
    title: "Mappings",
    href: "/integrations/mappings",
    description: "Confirm how external objects map to Solvren changes, issues, customers, and revenue workflows.",
    icon: Map,
  },
  {
    title: "Marketplace",
    href: "/marketplace/integrations",
    description: "Discover and connect more systems so Solvren can expand protection coverage.",
    icon: Boxes,
  },
];

export default function IntegrationsPage() {
  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Integrations" }]}
        title={PAGE_COPY.integrations.title}
        description={PAGE_COPY.integrations.description}
        helper={PAGE_COPY.integrations.helper}
        helpTrigger={<PageHelpDrawer page="integrations" />}
      />

      <Card className="border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_4%,var(--bg-surface)),var(--bg-surface)_72%)]">
        <CardBody className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Coverage workflow</p>
            <h2 className="mt-1 text-lg font-semibold">Connect, map, then expand protection.</h2>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="font-semibold">1. Connect</p>
              <p className="text-[var(--text-muted)]">Keep core systems healthy and authenticated.</p>
            </div>
            <div>
              <p className="font-semibold">2. Map</p>
              <p className="text-[var(--text-muted)]">Make sure Solvren understands the objects it sees.</p>
            </div>
            <div>
              <p className="font-semibold">3. Expand</p>
              <p className="text-[var(--text-muted)]">Add systems where revenue workflows still have gaps.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <SectionHeader title="Integration areas" helper="Everything needed to manage monitoring coverage is available here." />

      <Grid cols={3} gap={4}>
        {INTEGRATION_LINKS.map((item) => {
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
    </Stack>
  );
}
