import Link from "next/link";
import { PageHeader, Card, CardBody, Grid, Stack } from "@/ui";
import { PAGE_COPY } from "@/config/pageCopy";

const INSIGHT_LINKS = [
  {
    title: "Executive summary",
    href: "/insights/executive-summary",
    description: "High-level view of exposure, trends, and business impact.",
  },
  {
    title: "Revenue exposure",
    href: "/insights/revenue-exposure",
    description: "Where open risk is concentrated and how much revenue is exposed.",
  },
  {
    title: "Risk drivers",
    href: "/insights/risk-drivers",
    description: "Signals, contributors, and patterns driving revenue risk.",
  },
  {
    title: "ROI",
    href: "/insights/roi",
    description: "Verified outcomes and measurable value from solved issues and governed changes.",
  },
  {
    title: "Governance reports",
    href: "/insights/governance-reports",
    description: "Audit-friendly reporting for approvals, evidence, and governance health.",
  },
];

export default function InsightsLandingPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        breadcrumbs={[{ label: "Insights" }]}
        title={PAGE_COPY.insights.title}
        description={PAGE_COPY.insights.description}
      />

      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">
            Use Insights to understand revenue exposure, governance performance, and the verified business value
            Solvren is creating.
          </p>
        </CardBody>
      </Card>

      <Grid cols={3} gap={4}>
        {INSIGHT_LINKS.map((item) => (
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

