/**
 * Marketing / landing page copy — closed-loop Detect → Quantify → Act → Verify → Prove.
 * Terminology: Detect, Quantify, Act, Verify, Prove, revenue-impacting issues, playbooks, ROI.
 */

export const HERO = {
  headline: "Detect revenue risk — without exposing your data",
  subheadline:
    "Solvren works on system signals, metadata, and events — not your source-of-truth data. We detect revenue-impacting operational issues, estimate exposure with clear assumptions, and help you resolve them with auditable controls.",
  primaryCta: {
    label: "Get Started",
    href: "/signup",
  },
  secondaryCta: {
    label: "Book a Demo",
    href: "/contact",
  },
};

export const TRUST_BAR = {
  items: [
    "Signals and metadata — not warehouse-scale replication",
    "Redaction and minimization by default",
    "Read-only integrations; optional write-back with audit",
  ],
};

/** Section title for `WorkflowOverviewSection` (shared across pages that embed it). */
export const WORKFLOW_OVERVIEW = {
  eyebrow: "How it works",
  title: "From connection to governed insight — without owning your data",
};

export const CORE_LOOP = {
  title: "A closed-loop system for protecting revenue — with minimal data surface area",
  steps: [
    {
      title: "Detect",
      description:
        "Listen to operational signals from payments, CRM, and integrations — event patterns and metadata, not full customer or financial exports.",
    },
    {
      title: "Quantify",
      description:
        "Estimate impact with explicit assumptions and confidence — so teams prioritize what matters without needing ledger-level detail.",
    },
    {
      title: "Act",
      description:
        "Execute corrective actions automatically or with approval using reliable, idempotent playbooks (read-only by default; write-back when you enable it).",
    },
    {
      title: "Verify",
      description:
        "Confirm that actions succeeded and that the issue has been resolved.",
    },
    {
      title: "Prove",
      description:
        "Track estimated recovered value and avoided loss with assumptions surfaced for finance and executives.",
    },
  ],
};

export const VALUE_PROPS = [
  {
    title: "Detect Revenue-Impacting Issues",
    description:
      "Surface failed payments, CRM drift, refund leakage, and reconciliation risk from operational signals — before revenue is lost.",
  },
  {
    title: "Prioritize by Estimated Impact",
    description:
      "Score issues using failure rates, operational patterns, and configured assumptions — with confidence surfaced, not hidden.",
  },
  {
    title: "Fix Issues Safely",
    description:
      "Run approved playbooks with retries, idempotency, and safeguards. Read-only by default; write-back only when you turn it on.",
  },
  {
    title: "Verify Every Resolution",
    description:
      "Confirm fixes worked with validation and reconciliation before closing the issue.",
  },
  {
    title: "Prove Value to Leadership",
    description:
      "Share executive-ready reporting on estimated recovered value and avoided loss — with the estimation basis spelled out.",
  },
];

export const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Connect integrations",
    description:
      "Use read-oriented connectors with minimal permissions. No requirement to replicate full datasets or open your warehouse.",
  },
  {
    step: "2",
    title: "Listen for operational signals",
    description:
      "Solvren processes event-level signals and metadata — status changes, failures, and integration patterns — not full customer records.",
  },
  {
    step: "3",
    title: "Review impact and safeguards",
    description:
      "Review estimated impact, confidence, assumptions, and the recommended playbook before anything sensitive moves forward.",
  },
  {
    step: "4",
    title: "Approve or automate",
    description:
      "Approve the action or allow Solvren to run playbooks automatically. Write-back stays off unless you enable it.",
  },
  {
    step: "5",
    title: "Track estimated value",
    description:
      "Track estimated recovered value and prevented loss with clear provenance — not unaudited revenue claims.",
  },
];

export const USE_CASES = [
  {
    title: "Failed Payment Recovery",
    description:
      "Automatically detect and recover failed subscription and payment issues before revenue is lost.",
  },
  {
    title: "Refund Leakage",
    description:
      "Catch unnecessary or incorrect refunds and prevent money from slipping away.",
  },
  {
    title: "CRM & Billing Drift",
    description:
      "Find inconsistencies between systems like HubSpot, Salesforce, and Stripe before they create missed revenue or bad customer experiences.",
  },
  {
    title: "Revenue Reconciliation",
    description:
      "Detect mismatches between systems, reports, and workflows that create hidden financial risk.",
  },
  {
    title: "Change Risk & Governance",
    description:
      "Review high-risk operational changes before they create downstream revenue problems.",
  },
];

export const INTEGRATIONS = {
  title: "Connect the systems you already use",
  description:
    "Solvren listens through integrations for operational signals — without requiring bulk exports or a copy of your source-of-truth data.",
  items: [
    "Stripe",
    "HubSpot",
    "Salesforce",
    "Zendesk",
    "Custom APIs",
  ],
};

export const SAFE_AUTOMATION = {
  title: "Automation you can trust",
  points: [
    "Idempotent execution prevents duplicate actions",
    "Retry-safe workflows ensure reliability",
    "Policy controls and approvals for sensitive actions",
    "Full audit trail of every change",
  ],
};

export const ROI_SECTION = {
  title: "Estimated impact you can explain in a finance review",
  description:
    "Estimated revenue at risk based on failure rates, operational patterns, and assumptions you control — with confidence levels surfaced.",
  highlights: [
    "Estimated revenue at risk",
    "Trends over time",
    "Top operational risks",
    "ROI from resolved issues",
  ],
};

export const FINAL_CTA = {
  headline: "Stop revenue leaks before they become expensive problems.",
  subheadline:
    "Connect with minimal data scope, detect your first issue from signals, and prove value with clear estimation basis.",
  primaryCta: {
    label: "Get Started",
    href: "/signup",
  },
  secondaryCta: {
    label: "Book a Demo",
    href: "/contact",
  },
};

export const FOOTER = {
  tagline:
    "Solvren is a revenue protection platform that works on signals and metadata — not your source-of-truth data.",
};
