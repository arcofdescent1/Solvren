import {
  FinalCTASection,
  FirstWeekPilotSection,
  HeroSection,
  MarketingShell,
  PilotOfferSection,
  PricingCards,
  PricingEnterpriseSection,
  ProofArtifactsSection,
  SignalsMetadataTrustBlock,
  ValuePillarsSection,
  WhoThisIsForSection,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function PricingPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Pricing and pilot access"
        title="Find your first revenue risk in 14 days"
        subtitle="Solvren is offered through guided pilots for teams that want to protect pricing, billing, renewals, and revenue operations without expanding data scope."
        primaryCta={{ href: "/pilot", label: "Request Pilot" }}
        secondaryCta={{ href: "/revenue-protection", label: "What is revenue protection?" }}
        trustItems={["Minimal data required", "Read-only integrations", "No data replication", "Safe Mode onboarding"]}
      />
      <SignalsMetadataTrustBlock />
      <PricingCards />
      <WhoThisIsForSection />
      <FirstWeekPilotSection />
      <ProofArtifactsSection />
      <ValuePillarsSection />
      <PricingEnterpriseSection />
      <PilotOfferSection />
      <FinalCTASection
        title="Request the 14-day revenue protection pilot."
        body="Start with one workflow, one risk surface, and one proof packet before expanding."
        primaryCta={{ href: "/pilot", label: "Request Pilot" }}
        secondaryCta={{ href: "/contact", label: "Talk to sales" }}
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
