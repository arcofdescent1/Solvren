import { FinalCTASection, HeroSection, MarketingShell, SecurityGrid, FeatureShowcaseSection } from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function SecurityPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Security and controls"
        title="Built to govern sensitive, high-impact changes with restricted visibility and auditability."
        subtitle="Solvren combines role-based access control, domain permissions, restricted change visibility, evidence enforcement, timelines, and job-backed notifications to support disciplined operational governance."
        primaryCta={{ href: "/pricing", label: "Book trust walkthrough" }}
        secondaryCta={{ href: "/for-engineering", label: "See engineering controls" }}
        tertiaryCta={{ href: "/trust", label: "View Trust Center →" }}
      />
      <SecurityGrid />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Access control",
            title: "Role-aware by default, domain-aware where it matters, restricted when it has to be.",
            body: "Owners, admins, reviewers, submitters, and viewers all work from role-specific capabilities, while domain permissions and explicit grants keep finance, security, and legal work visible only to the right people.",
            bullets: [
              "RBAC enforced server-side for pages, APIs, search, and queues",
              "Domain review permissions help control who can see and approve domain-specific work",
              "Restricted changes support explicit access grants for exceptional cases",
            ],
            badge: "RBAC + domain permissions + restricted visibility",
            icon: "LockKeyhole",
          },
          {
            eyebrow: "Evidence and approvals",
            title: "Approval can be blocked when required safeguards are missing.",
            body: "The product is designed so critical changes do not move forward simply because someone clicked approve. Required evidence remains visible and enforceable until resolved.",
            bullets: [
              "Evidence items can be required or recommended",
              "Approval is blocked server-side when required evidence is missing",
              "Timeline and audit events capture enforcement actions clearly",
            ],
            badge: "Control over convenience",
            icon: "ShieldCheck",
            reverse: true,
          },
          {
            eyebrow: "Traceability",
            title: "Every meaningful action has a narrative and a system record.",
            body: "Change timelines, audit events, delivery state, and operational queues give teams a credible story of what happened, who acted, and what still needs attention.",
            bullets: [
              "Timeline events capture changes, approvals, evidence, and comments",
              "Notification and job state can be diagnosed instead of guessed at",
              "Search and queues remain visibility-safe even for restricted work",
            ],
            badge: "Auditability without manual assembly",
            icon: "Activity",
          },
        ]}
      />
      <FinalCTASection
        title="Trust matters most when the change is sensitive, cross-functional, and high consequence."
        body="Solvren is built to make those changes visible to the right people, blocked when safeguards are missing, and auditable over time."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
