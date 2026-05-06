import {
  ComparisonBand,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  MetricsStrip,
  SignalsMetadataTrustBlock,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function ExecutivesPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For executives"
        title="Know where revenue is at risk — without exposing your data"
        subtitle="Solvren gives leaders visibility into risky operational changes, blocked safeguards, and overdue approvals — using system signals and metadata, not copies of your financial systems."
        primaryCta={{ href: "/pricing", label: "Book executive walkthrough" }}
        secondaryCta={{ href: "/how-it-works", label: "See the workflow" }}
        trustItems={[
          "Estimated revenue at risk — with confidence and assumptions",
          "Trends and top risks without warehouse replication",
          "Auditable path from signal to decision",
        ]}
      />
      <SignalsMetadataTrustBlock />
      <MetricsStrip />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Executive visibility",
            title: "Risk, revenue exposure, and operational safety in one place.",
            body: "The executive dashboard surfaces what is in review, blocked by missing evidence, overdue, restricted, or carrying elevated estimated financial risk — so attention goes to the decisions that matter.",
            bullets: [
              "Estimated revenue at risk",
              "Trends over time",
              "Top operational risks",
              "ROI from resolved issues",
            ],
            badge: "Operational control center",
            icon: "BarChart3",
          },
          {
            eyebrow: "Trust",
            title: "Solvren does NOT require financial system access, customer-level data, or data warehouse replication.",
            body: "Instead, it uses system signals, event patterns, and derived estimates — so you get decision support without expanding your sensitive data footprint.",
            bullets: [
              "System signals — not bulk CRM or billing exports",
              "Event patterns across integrations you connect",
              "Derived estimates with explicit estimation basis",
            ],
            badge: "Minimal data footprint",
            icon: "ShieldCheck",
            reverse: true,
          },
          {
            eyebrow: "Revenue risk intelligence",
            title: "Estimated revenue at risk based on failure rates and operational patterns.",
            body: "Revenue Impact Reports summarize likely failure modes, estimated exposure, and safeguards that reduce risk most — using operational context, not unaudited claims about your books.",
            bullets: [
              "Translate technical changes into business risk language",
              "Confidence levels and assumptions included by design",
              "A defensible view of exposure before release",
            ],
            badge: "Decision support before release",
            icon: "CircleDollarSign",
          },
          {
            eyebrow: "Differentiation",
            title: "Most tools require your data. Solvren requires your signals.",
            body: "That difference is what keeps procurement and security reviews moving — you are not being asked to replicate your source of truth into another vendor silo.",
            bullets: [
              "Metadata and events instead of full datasets",
              "Read-only integrations to start",
              "Optional depth when you explicitly opt in",
            ],
            badge: "Why teams choose Solvren",
            icon: "Eye",
            reverse: true,
          },
          {
            eyebrow: "Coordination that scales",
            title: "Replace coordination by memory with a system of record.",
            body: "Solvren makes cross-functional governance repeatable: who should review, what evidence is required, and which gaps remain — without routing sensitive exports through chat.",
            bullets: [
              "Less manual coordination for every high-impact change",
              "Governance expectations visible to every participant",
              "Institutional knowledge that survives team turnover",
            ],
            badge: "Operational leverage",
            icon: "Bot",
          },
          {
            eyebrow: "Auditability",
            title: "Every approval, safeguard, and exception has a traceable story.",
            body: "Timelines, evidence enforcement, restricted visibility, and role-based access controls give leaders a clean narrative for how risky changes were handled.",
            bullets: [
              "Chronological timeline for every change",
              "Restricted changes stay restricted without losing accountability",
              "Evidence requirements and approvals remain auditable over time",
            ],
            badge: "Governance with accountability",
            icon: "FileCheck2",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FinalCTASection
        title="Executive control over revenue change risk — without a data warehouse science project."
        body="Solvren helps leaders reduce operational risk and shorten coordination cycles using signals and metadata aligned to how your systems already behave."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
