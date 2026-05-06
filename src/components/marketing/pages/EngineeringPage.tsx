import {
  ComparisonBand,
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  SecurityGrid,
  SignalsMetadataTrustBlock,
} from "@/components/marketing/MarketingBlocks";

/** When noShell, layout provides PublicShell. */
export function EngineeringPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="For engineering and platform teams"
        title="Built to integrate — without owning your data"
        subtitle="Solvren connects through APIs and webhooks for event-level signals. You keep databases and warehouses authoritative — we do not require wholesale replication to deliver governance."
        primaryCta={{ href: "/pricing", label: "Request technical walkthrough" }}
        secondaryCta={{ href: "/security", label: "See controls" }}
        trustItems={[
          "Inbound events → classification → redaction → normalization → signal layer",
          "Observable integrations with explicit scopes",
          "Write-back off until you enable it",
        ]}
      />
      <SignalsMetadataTrustBlock />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Scope",
            title: "What Solvren does not do",
            body: "We are not asking for database superuser credentials or a full clone of your production data. The architecture is built around least-privilege connectors and minimized payloads.",
            bullets: [
              "No requirement for direct database access",
              "No replication of your systems into ours",
              "No raw payload persistence by default",
              "No persisted PII in clear text",
            ],
            badge: "Integration boundaries",
            icon: "Cpu",
          },
          {
            eyebrow: "Architecture",
            title: "Inbound events → classification → redaction → normalization → signal layer",
            body: "This is the same path your production pipeline follows: events arrive, are classified, sensitive fields are minimized, normalized records feed detectors and workflows — with audit hooks at each step.",
            bullets: [
              "Typed ingestion boundaries in the product",
              "Redaction before operational persistence",
              "Normalization owned by the ingestion layer",
              "Signals consumed by detection and governance features",
            ],
            badge: "Phase 2 pipeline",
            icon: "Workflow",
            reverse: true,
          },
          {
            eyebrow: "Structured intake",
            title: "Replace vague operational tickets with the context reviewers need.",
            body: "Solvren captures system scope, rollout strategy, customer impact, evidence readiness, and governance metadata in one workflow — populated from signals, not from ad-hoc spreadsheets.",
            bullets: [
              "Draft, ready, and in-review lifecycle",
              "System and domain metadata drive automation",
              "Readiness logic catches incomplete changes early",
            ],
            badge: "Engineering signal, not ticket noise",
            icon: "Layers3",
          },
          {
            eyebrow: "Security",
            title: "Controls that match how you ship software",
            body: "Security is layered: redaction by default, envelope encryption for credentials, customer-controlled access for support, and logging that makes incidents diagnosable.",
            bullets: [
              "Redaction pipeline (default)",
              "Envelope encryption for credentials",
              "No plaintext secret storage",
              "Customer-controlled access for support sessions",
              "Full audit logging",
            ],
            badge: "Defense in depth",
            icon: "LockKeyhole",
            reverse: true,
          },
          {
            eyebrow: "Integration safety",
            title: "Least privilege from day one",
            body: "Connectors start read-oriented. Scopes are explicit in the product, and write-back requires an explicit organizational decision — not an accidental default.",
            bullets: ["Read-only by default", "Minimal permissions required", "No write-back unless enabled"],
            badge: "Safe connectivity",
            icon: "ShieldCheck",
          },
          {
            eyebrow: "Confidence",
            title: "Everything is observable, reversible, and auditable.",
            body: "Engineers should be able to answer what happened, who approved it, and how to roll back. Solvren keeps timelines, job state, and enforcement points visible in the product.",
            bullets: [
              "Observable pipelines and job diagnostics",
              "Reversible automation patterns (idempotency, retries)",
              "Auditable approvals and evidence enforcement",
            ],
            badge: "Operability",
            icon: "Gauge",
            reverse: true,
          },
        ]}
      />
      <SecurityGrid />
      <ComparisonBand />
      <FinalCTASection
        title="Engineering teams should not need three tools and a memory palace to ship a safe billing change."
        body="Solvren brings structure, controls, and review context — with a data model sized for signals, not for rebuilding your warehouse."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
