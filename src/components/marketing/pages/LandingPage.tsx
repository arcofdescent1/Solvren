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
  UseCasesSection,
  V1ValueCardsSection,
  V1FlowDiagramSection,
  ValuePillarsSection,
  WorkflowOverviewSection,
} from "@/components/marketing/MarketingBlocks";
import { HERO, SAFE_AUTOMATION, USE_CASES } from "@/components/marketing/landingCopy";

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
            title: "Surface revenue-impacting issues across your stack.",
            body: "Connect Stripe, HubSpot, Salesforce, and more. Detector packs continuously identify failed payments, refund leakage, CRM drift, and reconciliation gaps—with impact scores so you prioritize what matters.",
            bullets: [
              "Multi-system signal ingestion from payments, CRM, and operations",
              "Financial impact and confidence scoring for every issue",
              "Detector packs for failed payments, refund leakage, data integrity",
            ],
            badge: "Detection and quantification",
            icon: "Search",
          },
          {
            eyebrow: "Act & verify",
            title: "Run playbooks to fix issues—safely and reliably.",
            body: "Execute corrective actions automatically or with approval. Built-in retries, idempotency, and verification ensure every action actually worked before marking an issue resolved.",
            bullets: SAFE_AUTOMATION.points,
            badge: "Playbooks and verification",
            icon: "Zap",
            reverse: true,
          },
          {
            eyebrow: "Prove ROI",
            title: "Track recovered revenue and avoided loss in real time.",
            body: "Measure value with a clear dashboard: recovered revenue, avoided loss, playbook performance, and time-to-value. Share executive-ready ROI with stakeholders.",
            bullets: [
              "Recovered revenue and avoided loss tracking",
              "Playbook performance and success rates",
              "Executive dashboards with benchmarks and insights",
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
