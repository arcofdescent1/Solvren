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
      "Work Queue brings approvals, missing details, overdue work, and system follow-up into one prioritized place.",
    bullets: [
      "Start at the top: items are ordered by urgency and business impact.",
      "Use each item's recommended action to approve, add evidence, retry delivery, or follow up in context.",
      "Completed work automatically improves change, issue, readiness, and executive views.",
    ],
  },
  insights: {
    title: "How this page works",
    purpose:
      "Insights helps you understand exposure, governance outcomes, and business impact trends.",
    bullets: [
      "Start with executive summary for high-level direction.",
      "Use exposure drivers and revenue exposure for root-cause analysis.",
      "Use governance reports for compliance and audit context.",
    ],
  },
  risk_drivers: {
    title: "How this page works",
    purpose:
      "Exposure Drivers shows where business impact is concentrated and which systems, workflows, or review gaps need attention.",
    bullets: [
      "Use revenue exposure and direct-loss metrics for business context.",
      "Use open issue and impacted workflow counts to understand current workload.",
      "Use driver breakdowns to decide whether to fix a workflow, tighten a policy, or improve an integration.",
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
      "Settings manages the controls that decide who can act, when reviews are required, how people are notified, and which advanced diagnostics are available.",
    bullets: [
      "Start with Organization, Team & access, and Security for account-level controls.",
      "Use Policies & approvals, approval mappings, and attention routing to tune workflow behavior.",
      "Use Notifications and diagnostics when a team member or system needs operational follow-up.",
    ],
  },
  settings_policies: {
    title: "How this page works",
    purpose:
      "Revenue policies define when Solvren monitors, requires approval, or blocks risky revenue-impacting work.",
    bullets: [
      "Use enforcement mode to choose monitor, require approval, or block behavior.",
      "Use systems, domains, and rule type to scope where a policy applies.",
      "Use active policies to confirm coverage and find governance gaps.",
    ],
  },
} as const;

export type PageHelpKey = keyof typeof PAGE_HELP;
