import { ComparisonBand, FeatureShowcaseSection, FinalCTASection, HeroSection, MarketingShell } from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function FinancePage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For finance and RevOps"
        title="Put governance around the changes that can affect pricing, billing, and revenue reporting."
        subtitle="Solvren gives finance systems, RevOps, and billing leaders a structured way to review risky operational changes before they create invoice errors, reporting drift, or customer-facing billing issues."
        primaryCta={{ href: "/pricing", label: "Request finance demo" }}
        secondaryCta={{ href: "/for-executives", label: "See executive value" }}
      />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Pricing and billing governance",
            title: "Review high-risk changes before they become customer-facing billing problems.",
            body: "From pricing logic updates to subscription lifecycle changes, Solvren ensures the right stakeholders, evidence, and safeguards are visible before release.",
            bullets: [
              "Flag pricing and billing changes that deserve finance attention",
              "Require revenue validation, rollback plans, and test scenarios",
              "Keep billing owners and finance reviewers in the same workflow",
            ],
            badge: "Designed for revenue-critical changes",
            icon: "Receipt",
          },
          {
            eyebrow: "Revenue risk visibility",
            title: "Turn technical changes into language finance leaders can act on.",
            body: "Revenue Impact Reports summarize likely failure modes, potential exposure, and why a change matters — without making finance reconstruct the technical details from tickets and chat threads.",
            bullets: [
              "Explain likely invoice, pricing, and rev-rec failure modes",
              "Clarify why a change is low, medium, or high risk",
              "Show the safeguards that reduce exposure most",
            ],
            badge: "Finance-readable risk analysis",
            icon: "CircleDollarSign",
            reverse: true,
          },
          {
            eyebrow: "Cross-functional coordination",
            title: "Stop chasing engineering, billing owners, and approvers manually.",
            body: "Coordination Autopilot uses approval mappings and system ownership to recommend who should review and what evidence is needed, reducing the coordination burden on RevOps and finance systems teams.",
            bullets: [
              "Suggested finance reviewers and billing owners appear automatically",
              "Missing coverage is surfaced before submission",
              "Reviewers can approve with one complete operating record",
            ],
            badge: "Less coordination drag",
            icon: "Users",
          },
          {
            eyebrow: "Controls and traceability",
            title: "Create the audit trail your team wishes already existed.",
            body: "Evidence, approvals, timelines, and restricted visibility work together to make revenue-change handling more defensible over time.",
            bullets: [
              "See exactly who reviewed what and when",
              "Keep sensitive pricing and finance changes restricted where needed",
              "Use timelines and search to investigate issues faster later",
            ],
            badge: "Stronger operational accountability",
            icon: "FileCheck2",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FinalCTASection
        title="Finance teams should not find out about revenue-impacting change risk after release."
        body="Solvren gives finance and RevOps teams a practical control layer for pricing, billing, and revenue changes — before the customer or the close process pays the price."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
