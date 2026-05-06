import {
  ComparisonBand,
  FAQSection,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  SignalsMetadataTrustBlock,
  WorkflowOverviewSection,
  YourSystemsStaySection,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function HowItWorksPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Workflow overview"
        title="Detect operational risk — without exposing your data"
        subtitle="Solvren works on system signals, metadata, and events — not your source-of-truth data."
        primaryCta={{ href: "/pricing", label: "Request beta access" }}
        secondaryCta={{ href: "/login", label: "View the product" }}
        trustItems={[
          "Event-level signals — not full-table replication",
          "Redaction and minimization before persistence",
          "Read-only by default; write-back when you choose",
        ]}
      />
      <YourSystemsStaySection />
      <SignalsMetadataTrustBlock />
      <WorkflowOverviewSection />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Listening, not ingesting",
            title: "Solvren listens to what your systems do — not what they store.",
            body: "We process operational signals your integrations already emit: status changes, workflow transitions, failure events, and integration health — not full records or customer datasets.",
            bullets: ["Status changes", "Workflow transitions", "Failure events", "Integration signals"],
            badge: "Signal-first operations",
            icon: "Activity",
          },
          {
            eyebrow: "Before storage",
            title: "Redaction and minimization by default.",
            body: "Inbound data passes through classification and redaction. Sensitive fields are handled conservatively so stored artifacts support detection — not data warehousing.",
            bullets: [
              "Emails are hashed",
              "Names are redacted",
              "Financial values are minimized",
              "Raw payloads are not persisted",
            ],
            badge: "Privacy-preserving pipeline",
            icon: "ShieldCheck",
            reverse: true,
          },
          {
            eyebrow: "Insights",
            title: "Patterns that indicate revenue risk — from operations, not ledgers.",
            body: "Solvren detects patterns that indicate revenue risk based on operational signals and failure modes — not by analyzing your accounting system or transaction-level exports.",
            bullets: [
              "Failure-rate and drift signals",
              "Cross-system consistency checks where you connect",
              "Explainable scoring with surfaced assumptions",
            ],
            badge: "Operational intelligence",
            icon: "Search",
          },
          {
            eyebrow: "Action safety",
            title: "Solvren does not modify your systems by default.",
            body: "Integrations start read-oriented. Corrective actions use explicit scopes, and write-back is opt-in so teams can observe first and expand deliberately.",
            bullets: ["Read-only by default", "Write-back is optional", "All actions are auditable"],
            badge: "Controlled execution",
            icon: "LockKeyhole",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FAQSection />
      <FinalCTASection
        title="Every revenue-impacting change should tell one clear story."
        body="Solvren turns fragmented requests into a consistent workflow — with a data footprint sized for governance, not analytics warehouses."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
