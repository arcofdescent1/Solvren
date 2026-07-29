import type { Metadata } from "next";
import {
  ConcreteRiskExamplesSection,
  FinalCTASection,
  FirstWeekPilotSection,
  HeroSection,
  PilotOfferSection,
  ProofArtifactsSection,
  RevenueProtectionPromiseSection,
  SignalsMetadataTrustBlock,
  WhoThisIsForSection,
} from "@/components/marketing/MarketingBlocks";

export const metadata: Metadata = {
  title: "14-Day Revenue Protection Pilot",
  description:
    "Request the Solvren 14-Day Revenue Protection Pilot to connect one workflow, detect your first revenue risk, and produce your first proof packet.",
};

export default function PilotPage() {
  return (
    <>
      <HeroSection
        eyebrow="14-Day Revenue Protection Pilot"
        title="Find your first revenue risk in 14 days"
        subtitle="Start with one revenue workflow. Solvren helps connect Stripe, HubSpot, Salesforce, NetSuite, or Chargebee signals, detect the first meaningful issue, and produce an executive proof packet."
        primaryCta={{ href: "/pilot#pilot-request", label: "Request Pilot" }}
        secondaryCta={{ href: "/revenue-protection", label: "What is revenue protection?" }}
        trustItems={["One focused workflow", "Minimal data scope", "First proof packet", "Executive-ready review"]}
      />
      <RevenueProtectionPromiseSection />
      <SignalsMetadataTrustBlock />
      <WhoThisIsForSection />
      <FirstWeekPilotSection />
      <ConcreteRiskExamplesSection />
      <ProofArtifactsSection />
      <PilotOfferSection />
      <FinalCTASection
        title="Start with one risk surface. Prove value before expanding."
        body="The pilot is built to make the value obvious to finance, revenue operations, engineering, and executive buyers."
        primaryCta={{ href: "/pilot#pilot-request", label: "Request Pilot" }}
        secondaryCta={{ href: "/pricing", label: "View pricing" }}
      />
    </>
  );
}
