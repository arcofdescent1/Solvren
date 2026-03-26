export const PAGE_HELP = {
  home: {
    title: "How this page works",
    purpose:
      "Home is your revenue risk command center: priorities first, then assignments, blockers, exposure, and where Solvren is actively protecting the business.",
    bullets: [
      "Use Today's priorities for the most important work now.",
      "Use Assigned to me for direct ownership and follow-up.",
      "Use Waiting on others to understand external blockers.",
      "Use Revenue at risk for estimated business exposure context.",
    ],
  },
  changes: {
    title: "How this page works",
    purpose:
      "Changes helps you review revenue-impacting changes, understand blockers, and take one clear next action.",
    bullets: [
      "Use segments to focus on needs-review, needs-details, overdue, or delivery-health work.",
      "Open row details to see why the item surfaced and what happens next.",
      "Use bulk actions for nudge, retry, and export workflows.",
    ],
  },
  issues: {
    title: "How this page works",
    purpose:
      "Issues shows detected problems that may affect revenue workflows and guides investigation and resolution.",
    bullets: [
      "Use status tabs to move between open, assigned, and verification states.",
      "Filter by ownership and severity to prioritize impact.",
      "Open an issue for timeline, evidence, and resolution actions.",
    ],
  },
  actions: {
    title: "How this page works",
    purpose:
      "Action Center consolidates work that needs execution, follow-up, or operational attention.",
    bullets: [
      "Focus on items with pending or failed execution first.",
      "Use issue links to complete the next step in context.",
      "Completed actions automatically improve downstream status views.",
    ],
  },
  insights: {
    title: "How this page works",
    purpose:
      "Insights helps you understand exposure, governance outcomes, and business impact trends.",
    bullets: [
      "Start with executive summary for high-level direction.",
      "Use risk drivers and revenue exposure for root-cause analysis.",
      "Use governance reports for compliance and audit context.",
    ],
  },
  risk_drivers: {
    title: "How this page works",
    purpose:
      "Risk Drivers shows where business impact is concentrated and which models or workflows are contributing most to exposure.",
    bullets: [
      "Use revenue-at-risk and direct-loss metrics for impact context.",
      "Use open-issue and impacted counts to gauge current workload.",
      "Use detector-pack breakdown to identify concentration patterns.",
    ],
  },
  integrations: {
    title: "How this page works",
    purpose:
      "Integrations controls the systems Solvren monitors and directly affects coverage confidence.",
    bullets: [
      "Connected systems increase detection and monitoring coverage.",
      "Mappings define how external objects align to Solvren workflows.",
      "Marketplace helps expand protection to additional systems.",
    ],
  },
  settings: {
    title: "How this page works",
    purpose:
      "Settings manages organization, access, policies, and notifications that govern how Solvren operates.",
    bullets: [
      "Team & access controls ownership and permissions.",
      "Policies & approvals controls governance behavior.",
      "Notifications and diagnostics support operational reliability.",
    ],
  },
  settings_policies: {
    title: "How this page works",
    purpose:
      "Revenue Policies defines approval and enforcement guardrails for revenue-impacting changes.",
    bullets: [
      "Use enforcement mode to choose monitor, require-approval, or block behavior.",
      "Use systems and rule type to scope policy impact.",
      "Use active policies to verify coverage and detect gaps.",
    ],
  },
} as const;

export type PageHelpKey = keyof typeof PAGE_HELP;
