import Link from "next/link";
import {
  FeatureShowcaseSection,
  FinalCTASection,
  HeroSection,
  MarketingShell,
  SecurityDataHandlingTable,
  SecurityDataPhilosophySection,
  SignalsMetadataTrustBlock,
} from "@/components/marketing/MarketingBlocks";
import { DataBoundaryDiagram } from "@/components/security/DataBoundaryDiagram";

/** When noShell, layout provides PublicShell. */
export function SecurityPage({ noShell = false }: { noShell?: boolean }) {
  const content = (
    <>
      <HeroSection
        eyebrow="Security and controls"
        title="Built to minimize data — not collect it"
        subtitle="Solvren defaults to redaction, envelope encryption for secrets, customer-controlled access, and auditability — so security reviews focus on controls, not on another full copy of your business."
        primaryCta={{ href: "/pricing", label: "Book trust walkthrough" }}
        secondaryCta={{ href: "/for-engineering", label: "See engineering controls" }}
        tertiaryCta={{ href: "/trust", label: "View Trust Center →" }}
        trustItems={[
          "AES-256-GCM and envelope encryption for credentials",
          "Customer-controlled support access with time limits",
          "Break-glass flows for emergencies",
        ]}
      />
      <SignalsMetadataTrustBlock />
      <SecurityDataPhilosophySection />
      <SecurityDataHandlingTable />
      <FeatureShowcaseSection
        items={[
          {
            eyebrow: "Access control",
            title: "No standing employee access to your tenant data by default.",
            body: "Customer administrators grant support access when needed. Approvals are time-limited, scoped, and logged — with break-glass paths documented for true emergencies.",
            bullets: [
              "No employee access by default",
              "Customer-controlled support access",
              "Time-limited approvals",
              "Full audit logs",
              "Break-glass for emergencies",
            ],
            badge: "Zero standing access",
            icon: "LockKeyhole",
          },
          {
            eyebrow: "Encryption",
            title: "Modern cryptography for data at rest and credentials in flight.",
            body: "Secrets use envelope encryption with key versioning. We design away plaintext credential storage so integrations stay trustworthy.",
            bullets: [
              "AES-256-GCM for protected payloads",
              "Envelope encryption for integration secrets",
              "Key versioning and rotation paths",
              "No plaintext secret storage",
            ],
            badge: "Cryptographic hygiene",
            icon: "ShieldCheck",
            reverse: true,
          },
          {
            eyebrow: "Integration safety",
            title: "Read-only by default; write-back is an explicit decision.",
            body: "Scopes are visible in-product. Write paths require explicit enablement so security teams can reason about blast radius before go-live.",
            bullets: ["Read-only by default", "Explicit write enablement", "Transparent scopes per connector"],
            badge: "Least privilege",
            icon: "Eye",
          },
          {
            eyebrow: "Evidence and enforcement",
            title: "Approval can be blocked when required safeguards are missing.",
            body: "Critical changes do not advance simply because someone clicked approve. Required evidence stays visible and enforceable until resolved.",
            bullets: [
              "Evidence items can be required or recommended",
              "Server-side enforcement when policy demands it",
              "Timeline and audit events capture enforcement clearly",
            ],
            badge: "Control over convenience",
            icon: "FileCheck2",
            reverse: true,
          },
          {
            eyebrow: "Traceability",
            title: "Every meaningful action has a narrative and a system record.",
            body: "Timelines, delivery state, and operational queues give teams a credible story of what happened, who acted, and what still needs attention.",
            bullets: [
              "Timeline events for changes, approvals, evidence, and comments",
              "Job and notification state you can diagnose",
              "Search and queues that respect visibility rules",
            ],
            badge: "Auditability without manual assembly",
            icon: "Activity",
          },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6 lg:px-8">
        <DataBoundaryDiagram />
      </div>
      <p className="mx-auto max-w-7xl px-4 pb-10 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
        <Link href="/security/baseline" className="font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline">
          Security baseline
        </Link>
        <span aria-hidden className="mx-2 text-slate-600">
          ·
        </span>
        <Link href="/trust" className="font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline">
          Trust Center
        </Link>
      </p>
      <FinalCTASection
        title="Trust matters most when the change is sensitive, cross-functional, and high consequence."
        body="Solvren is built to keep data minimal, access explicit, and every sensitive action observable."
      />
    </>
  );
  return noShell ? content : <MarketingShell>{content}</MarketingShell>;
}
