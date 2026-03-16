/**
 * Gap 3 — Integration readiness framework.
 * Every integration declares a tier; UI uses this for badges and expectations.
 */

export type ReadinessTier = "production" | "beta" | "coming_soon";

export type IntegrationReadinessMeta = {
  tier: ReadinessTier;
  name: string;
  /** Short capability description for marketplace cards */
  shortDescription: string;
  /** What Solvren monitors (capability transparency) */
  whatWeMonitor: string[];
  /** What Solvren does not yet monitor */
  whatWeDoNotMonitor: string[];
  /** Optional docs path relative to /docs */
  docsPath?: string;
};

const JIRA_META: IntegrationReadinessMeta = {
  tier: "production",
  name: "Jira",
  shortDescription: "Detect revenue-impacting changes from Jira issues and link governance approvals.",
  whatWeMonitor: [
    "Issue updates",
    "Status transitions",
    "Custom field changes",
    "Linked revenue change tickets",
  ],
  whatWeDoNotMonitor: [
    "Workflow configuration changes",
    "Jira automation rule changes",
  ],
  docsPath: "integrations/jira",
};

const SLACK_META: IntegrationReadinessMeta = {
  tier: "production",
  name: "Slack",
  shortDescription: "Send approval requests and notifications to Slack; resolve approvals from channels.",
  whatWeMonitor: [
    "Approval actions from Slack",
    "Notification delivery status",
  ],
  whatWeDoNotMonitor: [
    "Slack workspace configuration",
    "Channel membership changes",
  ],
  docsPath: "integrations/slack",
};

const SALESFORCE_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "Salesforce",
  shortDescription: "Monitor pricing and opportunity configuration changes.",
  whatWeMonitor: [
    "Opportunity and quote changes",
    "Pricing configuration updates",
  ],
  whatWeDoNotMonitor: [
    "Full object sync",
    "Workflow and process builder changes",
  ],
  docsPath: "integrations/salesforce",
};

const HUBSPOT_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "HubSpot",
  shortDescription: "Sync deals and pipeline data for revenue context.",
  whatWeMonitor: [
    "Deal stage and property changes",
    "Pipeline visibility",
  ],
  whatWeDoNotMonitor: [
    "Marketing and email events",
    "Full CRM object history",
  ],
  docsPath: "integrations/hubspot",
};

const NETSUITE_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "NetSuite",
  shortDescription: "Connect billing and financial data for governance context.",
  whatWeMonitor: [
    "Billing and subscription-related entities",
    "Revenue recognition data",
  ],
  whatWeDoNotMonitor: [
    "Full ERP sync",
    "Inventory and order management",
  ],
  docsPath: "integrations/netsuite",
};

const GITHUB_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "GitHub",
  shortDescription: "Link commits and deployments to revenue changes for audit trail.",
  whatWeMonitor: [
    "Repository and branch context",
    "Deployment and release events",
  ],
  whatWeDoNotMonitor: [
    "Code content",
    "PR review and comment events",
  ],
  docsPath: "integrations/github",
};

export type IntegrationProvider = keyof typeof INTEGRATION_READINESS;

export const INTEGRATION_READINESS: Record<string, IntegrationReadinessMeta> = {
  jira: JIRA_META,
  slack: SLACK_META,
  salesforce: SALESFORCE_META,
  hubspot: HUBSPOT_META,
  netsuite: NETSUITE_META,
  github: GITHUB_META,
};

export function getReadinessMeta(provider: string): IntegrationReadinessMeta | null {
  return INTEGRATION_READINESS[provider.toLowerCase()] ?? null;
}

export function getReadinessTier(provider: string): ReadinessTier {
  return getReadinessMeta(provider)?.tier ?? "coming_soon";
}

/** Badge label for UI */
export function getReadinessBadgeLabel(tier: ReadinessTier): string {
  switch (tier) {
    case "production":
      return "Production Ready";
    case "beta":
      return "Beta";
    case "coming_soon":
      return "Coming Soon";
    default:
      return "Coming Soon";
  }
}
