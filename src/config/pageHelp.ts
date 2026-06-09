import { PRODUCT_TERMS } from "@/config/productLanguage";

export const PAGE_HELP = {
  home: {
    title: "How this page works",
    purpose:
      "Home shows the plain answer first: what revenue is at risk, what needs attention, and what Solvren is protecting.",
    bullets: [
      "Start with the money and the few items that need attention.",
      "Use the primary action to review the most important work.",
      "Look lower on the page only when you need supporting context.",
      "Coverage and activity show whether Solvren is protecting the right systems.",
    ],
  },
  changes: {
    title: "How this page works",
    purpose:
      `${PRODUCT_TERMS.changes.title} helps you review revenue-sensitive changes, understand blockers, and take one clear next action.`,
    bullets: [
      "Use filters to focus on decisions, missing proof, overdue work, or delivery follow-up.",
      "Open row details to see why the item surfaced and what happens next.",
      "Use bulk actions for nudge, retry, and export workflows.",
    ],
  },
  issues: {
    title: "How this page works",
    purpose:
      `${PRODUCT_TERMS.problems.title} shows detected problems that may affect revenue and guides investigation and resolution.`,
    bullets: [
      "Use status tabs to move between open, assigned, and verification states.",
      "Filter by ownership and severity to prioritize impact.",
      "Open a problem for timeline, proof, and resolution actions.",
    ],
  },
  actions: {
    title: "How this page works",
    purpose:
      `${PRODUCT_TERMS.decisions.title} brings approvals, missing proof, overdue work, and follow-up into one prioritized place.`,
    bullets: [
      "Start at the top: items are ordered by urgency and business impact.",
      "Use each item's recommended action to approve, add proof, retry delivery, or follow up in context.",
      "Completed work automatically improves change reviews, problems, proof, and leadership views.",
    ],
  },
  insights: {
    title: "How this page works",
    purpose:
      `${PRODUCT_TERMS.proof.title} helps you understand exposure, protected value, and business impact trends.`,
    bullets: [
      "Start with the current money at risk and whether it is improving.",
      "Use exposure drivers to understand what is causing risk.",
      "Use reports when you need board-ready or audit-ready proof.",
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
