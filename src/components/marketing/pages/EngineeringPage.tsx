import { ComparisonBand, FeatureShowcaseSection, FinalCTASection, HeroSection, MarketingShell, SecurityGrid } from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function EngineeringPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For engineering and platform teams"
        title="Govern revenue-impacting changes without slowing engineering down."
        subtitle="Solvren gives platform, application, and RevOps engineering teams one governed workflow for pricing, billing, subscription, and revenue-system changes — with complete context at review time."
        primaryCta={{ href: "/pricing", label: "Request technical walkthrough" }}
        secondaryCta={{ href: "/security", label: "See controls" }}
      />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Structured intake",
            title: "Replace vague operational tickets with the context your reviewers actually need.",
            body: "Solvren captures system scope, rollout strategy, customer impact, evidence readiness, and governance metadata in one workflow so reviewers do not reconstruct the change from scattered tools.",
            bullets: [
              "Draft, ready, and in-review lifecycle separates preparation from approval",
              "System and domain metadata drive automation downstream",
              "Readiness logic catches incomplete changes before queue pollution starts",
            ],
            badge: "Engineering signal, not ticket noise",
            icon: "Layers3",
          },
          {
            eyebrow: "Controls",
            title: "Keep the rules explainable: mappings, roles, evidence, and permissions all live in the product.",
            body: "Approval role mappings, domain permissions, restricted visibility, and evidence enforcement are built into the workflow so governance does not live in tribal memory or side spreadsheets.",
            bullets: [
              "Approvers are suggested from system, domain, and change-type mappings",
              "Required evidence can block approval server-side",
              "Restricted changes inherit visibility rules through search, queues, and notifications",
            ],
            badge: "Deterministic governance architecture",
            icon: "Cpu",
            reverse: true,
          },
          {
            eyebrow: "Review ergonomics",
            title: "Give reviewers the full story on one screen.",
            body: "Approvers can review evidence, the coordination plan, revenue impact analysis, and the timeline in one place instead of piecing the record together manually.",
            bullets: [
              "My Approvals, blocked, and overdue queues route work cleanly",
              "Timelines show exactly how the change evolved",
              "Search makes changes, evidence, and approvals retrievable fast",
            ],
            badge: "Operational workflow, not workflow theater",
            icon: "Gauge",
          },
          {
            eyebrow: "Premium differentiator",
            title: "The system tells you what to do next instead of waiting for humans to remember.",
            body: "Coordination Autopilot and Revenue Impact Reports transform governance from a manual burden into a repeatable operating layer that actually reduces toil.",
            bullets: [
              "One-click approver and evidence application",
              "Risk analysis stays versioned and auditable",
              "Queues and notifications stay synchronized to the actual state of work",
            ],
            badge: "Automation that reduces load",
            icon: "BrainCircuit",
            reverse: true,
          },
        ]}
      />
      <SecurityGrid />
      <ComparisonBand />
      <FinalCTASection
        title="Engineering teams should not need three tools and a memory palace to ship a safe billing change."
        body="Solvren brings the structure, controls, and review context engineering teams need to move high-impact operational changes without coordination chaos."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
