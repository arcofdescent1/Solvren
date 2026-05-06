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
  SignalsMetadataTrustBlock,
  UseCasesSection,
  V1ValueCardsSection,
  V1FlowDiagramSection,
  ValuePillarsSection,
  WhyThisIsSafeSection,
  WorkflowOverviewSection,
} from "@/components/marketing/MarketingBlocks";
import { HERO, SAFE_AUTOMATION } from "@/components/marketing/landingCopy";

/** When true, render content only (layout provides PublicShell). */
export function LandingPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Revenue protection platform"
        title={HERO.headline}
        subtitle={HERO.subheadline}
        primaryCta={HERO.primaryCta}
        secondaryCta={HERO.secondaryCta}
      />
      <SignalsMetadataTrustBlock />
      <WhyThisIsSafeSection />
      <V1ValueCardsSection />
      <V1FlowDiagramSection />
      <LogoStrip />
      <ProblemSection />
      <ValuePillarsSection />
      <WorkflowOverviewSection />
      <UseCasesSection />
      <MetricsStrip />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Detect & quantify",
            title: "Surface revenue-impacting issues from operational signals.",
            body: "Connect Stripe, HubSpot, Salesforce, and more with connectors scoped for events and metadata. Detector packs surface failed payments, refund leakage, CRM drift, and reconciliation gaps — with impact estimates and confidence, not unaudited revenue claims.",
            bullets: [
              "Multi-system signals from payments, CRM, and operations",
              "Estimated impact with explicit assumptions",
              "Detector packs tuned for failure modes, not bulk data dumps",
            ],
            badge: "Detection and quantification",
            icon: "Search",
          },
          {
            eyebrow: "Act & verify",
            title: "Run playbooks to fix issues — safely and reliably.",
            body: "Execute corrective actions automatically or with approval. Built-in retries, idempotency, and verification ensure every action actually worked before marking an issue resolved.",
            bullets: SAFE_AUTOMATION.points,
            badge: "Playbooks and verification",
            icon: "Zap",
            reverse: true,
          },
          {
            eyebrow: "Prove value",
            title: "Track estimated recovered value and avoided loss.",
            body: "Measure value with a clear dashboard: estimated recovered revenue, avoided loss, playbook performance, and time-to-value. Share executive-ready views with the estimation basis on the page.",
            bullets: [
              "Estimated recovered revenue and avoided loss",
              "Playbook performance and success rates",
              "Executive dashboards with confidence and assumptions",
            ],
            badge: "Value and ROI",
            icon: "BarChart3",
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
