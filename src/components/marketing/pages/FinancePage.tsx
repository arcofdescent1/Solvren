import {
  ComparisonBand,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  SignalsMetadataTrustBlock,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function FinancePage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For finance and RevOps"
        title="Understand financial impact — without exposing financial data"
        subtitle="Solvren estimates financial risk from operational behavior — failure rates, integration health, and change patterns — not from unrestricted access to your accounting systems."
        primaryCta={{ href: "/pricing", label: "Request finance demo" }}
        secondaryCta={{ href: "/for-executives", label: "See executive value" }}
        trustItems={[
          "No mandate for accounting system credentials",
          "Estimates with confidence and stated assumptions",
          "Audit trail from signal to approval",
        ]}
      />
      <SignalsMetadataTrustBlock />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Core idea",
            title: "Operational behavior → estimated financial risk.",
            body: "Solvren connects what engineering and RevOps are changing to the operational signals that precede invoice errors, reporting drift, and customer-facing billing issues — so finance can intervene before close surprises.",
            bullets: [
              "Failure-rate and drift signals from connected systems",
              "Estimated exposure using patterns, not ledger dumps",
              "Clear handoff between operational and finance language",
            ],
            badge: "Finance-readable framing",
            icon: "Receipt",
          },
          {
            eyebrow: "What we don't need",
            title: "We do not require accounting access, transaction-level data, or financial statements.",
            body: "If you choose expanded modes later, you control what depth is shared. The default path is designed for procurement and internal audit conversations.",
            bullets: [
              "No accounting system access required to start",
              "No transaction-level data requirement",
              "No financial statement ingestion",
            ],
            badge: "Scope you can defend",
            icon: "Landmark",
            reverse: true,
          },
          {
            eyebrow: "Model",
            title: "Failure rate × deal velocity × estimated value",
            body: "Directional estimates combine how often failures occur, how many revenue-touching events are in flight, and conservative value assumptions you can tune — so numbers come with a story, not false precision.",
            bullets: [
              "Transparent formula with versioned methodology",
              "Assumptions visible next to the estimate",
              "Confidence levels instead of fake decimals",
            ],
            badge: "Estimation basis",
            icon: "CircleDollarSign",
          },
          {
            eyebrow: "Confidence model",
            title: "Each insight includes confidence, assumptions, and estimation basis.",
            body: "Finance teams should never wonder where a number came from. Solvren surfaces what was observed, what was inferred, and how conservative the model is being.",
            bullets: ["Confidence level on each insight", "Assumptions used", "Estimation basis and provenance"],
            badge: "Board-ready honesty",
            icon: "FileCheck2",
            reverse: true,
          },
          {
            eyebrow: "Governance",
            title: "Review high-risk changes before they become billing or rev-rec incidents.",
            body: "Pricing logic, subscription lifecycle, and revenue-recognition-adjacent changes stay in a workflow with evidence, approvers, and timelines — aligned to how you already manage risk.",
            bullets: [
              "Flag changes that deserve finance attention",
              "Require validation artifacts where your policy demands them",
              "Keep billing owners and finance reviewers in one system of record",
            ],
            badge: "Designed for revenue-critical changes",
            icon: "Users",
          },
          {
            eyebrow: "Traceability",
            title: "Create the audit trail your team wishes already existed.",
            body: "Evidence, approvals, timelines, and restricted visibility work together so revenue-change handling stays defensible.",
            bullets: [
              "See exactly who reviewed what and when",
              "Restrict sensitive pricing work without losing accountability",
              "Investigate faster later with search and timelines",
            ],
            badge: "Operational accountability",
            icon: "Activity",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FinalCTASection
        title="Finance teams should not find out about revenue-impacting change risk after release."
        body="Solvren gives finance and RevOps a practical control layer — grounded in operational signals and explicit estimates, not in copying your GL."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
