import { FinalCTASection, HeroSection, MarketingShell, PricingCards, ValuePillarsSection } from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function PricingPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Pricing and beta access"
        title="Start with a high-impact pilot, not a commodity seat count."
        subtitle="Solvren is currently offered through guided beta programs for organizations that manage pricing, billing, subscription, or revenue-recognition changes with meaningful operational risk."
        primaryCta={{ href: "/login", label: "Request beta access" }}
        secondaryCta={{ href: "/how-it-works", label: "See how it works" }}
      />
      <PricingCards />
      <ValuePillarsSection />
      <FinalCTASection
        title="The fastest way to see value is to govern one risky workflow first."
        body="Most early teams start with pricing changes, billing logic, or revenue-recognition workflows. Once the control layer proves value there, expansion to adjacent systems becomes obvious."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
