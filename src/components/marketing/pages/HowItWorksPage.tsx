import {
  ComparisonBand,
  FAQSection,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  WorkflowOverviewSection,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function HowItWorksPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Workflow overview"
        title="From risky change request to governed release in one visible flow."
        subtitle="Solvren gives submitters, reviewers, and leaders one system to capture the change, coordinate safeguards, analyze risk, and move high-impact work through approval with confidence."
        primaryCta={{ href: "/pricing", label: "Request beta access" }}
        secondaryCta={{ href: "/login", label: "View the product" }}
      />
      <WorkflowOverviewSection />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Step 1",
            title: "Create a structured change, not another vague ticket.",
            body: "The guided intake gathers the systems, domains, rollout plan, customer impact, and operational details that determine who must be involved and how risky the change really is.",
            bullets: [
              "Draft and ready states keep reviewers out of incomplete work",
              "Structured fields drive automation downstream",
              "Readiness checks show what still needs attention before submission",
            ],
            badge: "Guided intake",
            icon: "Layers3",
          },
          {
            eyebrow: "Step 2",
            title: "Generate the Coordination Plan and apply the right safeguards in one click.",
            body: "Solvren uses your approval mappings, domain rules, system ownership, and governance controls to identify who should review, what evidence is required, and where routing is still missing coverage.",
            bullets: [
              "Suggested approvers are tied to actual org roles and permissions",
              "Evidence requirements are generated from change type, systems, and rollout profile",
              "Blockers surface missing reviewer coverage before a risky change moves forward",
            ],
            badge: "Coordination Autopilot",
            icon: "Bot",
            reverse: true,
          },
          {
            eyebrow: "Step 3",
            title: "Generate a Revenue Impact Report leaders can actually use.",
            body: "Each risky change gets a structured report showing likely failure modes, operational impact, risk score, and the actions that reduce exposure most.",
            bullets: [
              "Hybrid AI + rules output keeps the report explainable",
              "Safeguards and approvals align to the actual risk context",
              "Versioned reports remain visible during review and later audits",
            ],
            badge: "Revenue Impact Intelligence",
            icon: "CircleDollarSign",
          },
          {
            eyebrow: "Step 4",
            title: "Review with full context, not reconstruction work.",
            body: "Reviewers work from one page that includes the timeline, evidence, coordination plan, and risk analysis. Dashboards show what is blocked, overdue, restricted, and high risk.",
            bullets: [
              "Approvals can be blocked when required evidence is missing",
              "Queues route work by assignment and visibility rules",
              "Search and timelines make investigations fast and auditable",
            ],
            badge: "Governed review and release",
            icon: "Gauge",
            reverse: true,
          },
        ]}
      />
      <ComparisonBand />
      <FAQSection />
      <FinalCTASection
        title="Every revenue-impacting change should tell one clear story."
        body="Solvren turns fragmented requests into a consistent workflow: capture the change, coordinate the work, analyze the risk, and review with context before release."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
