import {
  FinalCTASection,
  HeroSection,
  MarketingShell,
  PricingCards,
  PricingEnterpriseSection,
  SignalsMetadataTrustBlock,
  ValuePillarsSection,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function PricingPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Pricing and beta access"
        title="Start without sharing sensitive data"
        subtitle="Solvren is offered through guided beta programs for teams that want governance on pricing, billing, and revenue-recognition changes — with a signals-first onboarding path that keeps scope small until you expand it."
        primaryCta={{ href: "/login", label: "Request beta access" }}
        secondaryCta={{ href: "/how-it-works", label: "See how it works" }}
        trustItems={["Minimal data required", "Read-only integrations", "No data replication", "Safe Mode onboarding"]}
      />
      <SignalsMetadataTrustBlock />
      <PricingCards />
      <ValuePillarsSection />
      <PricingEnterpriseSection />
      <FinalCTASection
        title="The fastest way to see value is to govern one risky workflow first."
        body="Most early teams start with pricing changes, billing logic, or revenue-recognition workflows. Prove the control layer on signals — then expand depth deliberately."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
