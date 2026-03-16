import { FeatureShowcaseSection, FinalCTASection, HeroSection, MarketingShell, MetricsStrip, ComparisonBand } from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function ExecutivesPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For executives"
        title="Reduce the financial risk of operational system changes before they hit customers or reporting."
        subtitle="Solvren gives finance, operations, and technology leaders visibility into risky changes, blocked safeguards, and overdue approvals across the revenue stack."
        primaryCta={{ href: "/pricing", label: "Book executive walkthrough" }}
        secondaryCta={{ href: "/how-it-works", label: "See the workflow" }}
      />
      <MetricsStrip />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Executive visibility",
            title: "See the changes that matter most — before they become incidents.",
            body: "The executive dashboard surfaces what is in review, blocked by missing evidence, overdue, restricted, or carrying elevated financial risk so leaders can focus attention where it matters most.",
            bullets: [
              "High-risk changes are visible while they are still actionable",
              "Blocked and overdue work stops hiding inside operational tools",
              "Leaders get one view of exposure across pricing, billing, and revenue systems",
            ],
            badge: "Operational control center",
            icon: "BarChart3",
          },
          {
            eyebrow: "Revenue risk intelligence",
            title: "Understand not just that a change exists — but why it deserves attention.",
            body: "Revenue Impact Reports summarize likely failure modes, business exposure, and the safeguards that reduce risk most, so approval conversations happen with complete context.",
            bullets: [
              "Translate technical changes into business risk language",
              "Explain why a billing or pricing change is risky before release",
              "Give executives a defensible view of change exposure and readiness",
            ],
            badge: "Decision support before release",
            icon: "CircleDollarSign",
            reverse: true,
          },
          {
            eyebrow: "Coordination that scales",
            title: "Replace coordination by memory with a system of record.",
            body: "Solvren makes cross-functional governance repeatable. The system recommends who should review, what evidence is required, and which gaps still exist instead of relying on spreadsheets and Slack memory.",
            bullets: [
              "Reduce manual coordination overhead for every high-impact change",
              "Make governance expectations visible to every participant",
              "Capture institutional knowledge that survives team turnover",
            ],
            badge: "Operational leverage",
            icon: "Bot",
          },
          {
            eyebrow: "Auditability",
            title: "Every approval, safeguard, and exception has a traceable story.",
            body: "With timelines, evidence enforcement, restricted visibility, and role-based access controls, leaders gain a clean narrative for how risky changes were handled — and where process is breaking down.",
            bullets: [
              "Chronological timeline for every change",
              "Restricted changes stay restricted without losing accountability",
              "Evidence requirements and approval actions remain auditable over time",
            ],
            badge: "Governance with accountability",
            icon: "ShieldCheck",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FinalCTASection
        title="This is what executive control over revenue change risk looks like."
        body="Solvren helps leaders reduce operational risk, shorten coordination cycles, and create visibility into the changes that can affect billing, pricing, and revenue reporting most."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
