import Link from "next/link";
import { PageHeader, Card, CardBody, Grid, Stack } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";

const INTEGRATION_LINKS = [
  { title: "Connected systems", href: "/org/settings/integrations", description: "Manage connected systems and status." },
  { title: "Mappings", href: "/integrations/mappings", description: "Review object mappings and sync shape." },
  { title: "Marketplace", href: "/marketplace/integrations", description: "Discover and connect additional providers." },
];

export default function IntegrationsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        breadcrumbs={[{ label: "Integrations" }]}
        title={PAGE_COPY.integrations.title}
        description={PAGE_COPY.integrations.description}
      />
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">{PAGE_COPY.integrations.helper}</p>
        </CardBody>
      </Card>
      <Grid cols={3} gap={4}>
        {INTEGRATION_LINKS.map((item) => (
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
