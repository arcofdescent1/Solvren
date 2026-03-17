import {
  AudienceCardsSection,
  ComparisonBand,
  FAQSection,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  LogoStrip,
  MarketingShell,
  MetricsStrip,
  ProblemSection,
  V1ValueCardsSection,
  V1FlowDiagramSection,
  ValuePillarsSection,
  WorkflowOverviewSection,
} from "@/components/marketing/MarketingBlocks";

/** When true, render content only (layout provides PublicShell). */
export function LandingPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Revenue risk intelligence"
        title="Protect Revenue From Uncontrolled System Changes"
        subtitle="Solvren detects, governs, and audits revenue-impacting changes across your systems."
        primaryCta={{ href: "/signup", label: "Start Free Trial" }}
        secondaryCta={{ href: "/how-it-works", label: "Watch Demo" }}
      />
      <V1ValueCardsSection />
      <V1FlowDiagramSection />
      <LogoStrip />
      <ProblemSection />
      <ValuePillarsSection />
      <WorkflowOverviewSection />
      <MetricsStrip />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Guided intake",
            title: "Capture the change once — with the context reviewers actually need.",
            body: "Move from informal change requests to structured intake that captures systems, domains, rollout strategy, customer impact, and revenue context in one governed workflow.",
            bullets: [
              "Multi-step workflow replaces giant ticket forms",
              "Readiness logic shows what is still incomplete",
              "Draft, ready, and in-review lifecycle keeps reviewers focused on real work",
            ],
            badge: "Structured intake and readiness",
            icon: "Layers3",
          },
          {
            eyebrow: "Revenue Impact Reports",
            title: "Turn risky operational changes into executive-ready decision support.",
            body: "Surface financial exposure, likely failure modes, and the safeguards that reduce risk most before a pricing or billing change ever reaches production.",
            bullets: [
              "Risk score and executive summary generated in context",
              "Potential failure modes grounded in systems and change type",
              "Required safeguards and approvals surfaced before signoff",
            ],
            badge: "AI + rules-based risk analysis",
            icon: "CircleDollarSign",
            reverse: true,
          },
          {
            eyebrow: "Coordination Autopilot",
            title: "Stop chasing reviewers, evidence, and stakeholders across Slack and spreadsheets.",
            body: "Automatically suggest the right approvers, evidence checklist, and routing based on mappings, system ownership, domains, and organizational controls.",
            bullets: [
              "Approver suggestions based on domain and system mappings",
              "Evidence checklist generated from actual operational risk",
              "Coverage gaps surfaced before a risky change slips forward",
            ],
            badge: "One-click coordination",
            icon: "Bot",
          },
        ]}
      />
      <ComparisonBand />
      <AudienceCardsSection />
      <FAQSection />
      <FinalCTASection />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
