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

const CSV_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "CSV Import",
  shortDescription: "Import data from CSV files for customer exports and historical backfill.",
  whatWeMonitor: ["Uploaded file rows", "Mapped canonical objects"],
  whatWeDoNotMonitor: ["Recurring file drops", "Auto-refresh"],
};

const STRIPE_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "Stripe",
  shortDescription: "Identify failed payment patterns and at-risk subscription revenue.",
  whatWeMonitor: [
    "Customers and subscriptions",
    "Invoices and payment intents",
    "Failed charges and disputes",
  ],
  whatWeDoNotMonitor: [
    "Full transaction history",
    "Product and price catalog changes",
  ],
  docsPath: "integrations/stripe",
};

const POSTGRES_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "PostgreSQL",
  shortDescription: "Sync read-only data from PostgreSQL for revenue context.",
  whatWeMonitor: ["Table snapshots", "Incremental sync with cursor"],
  whatWeDoNotMonitor: ["Write operations", "DDL changes"],
};

const MYSQL_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "MySQL",
  shortDescription: "Sync read-only data from MySQL for revenue context.",
  whatWeMonitor: ["Table snapshots", "Incremental sync with cursor"],
  whatWeDoNotMonitor: ["Write operations", "DDL changes"],
};

const SNOWFLAKE_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "Snowflake",
  shortDescription: "Sync data from Snowflake warehouse for revenue context.",
  whatWeMonitor: ["Table/query snapshots", "Warehouse data sync"],
  whatWeDoNotMonitor: ["Real-time streams", "Write operations"],
};

const BIGQUERY_META: IntegrationReadinessMeta = {
  tier: "beta",
  name: "BigQuery",
  shortDescription: "Sync data from BigQuery for revenue context.",
  whatWeMonitor: ["Table snapshots", "Warehouse data sync"],
  whatWeDoNotMonitor: ["Real-time streams", "Write operations"],
};

export type IntegrationProvider = keyof typeof INTEGRATION_READINESS;

export const INTEGRATION_READINESS: Record<string, IntegrationReadinessMeta> = {
  jira: JIRA_META,
  slack: SLACK_META,
  csv: CSV_META,
  salesforce: SALESFORCE_META,
  hubspot: HUBSPOT_META,
  netsuite: NETSUITE_META,
  github: GITHUB_META,
  stripe: STRIPE_META,
  postgres_readonly: POSTGRES_META,
  mysql_readonly: MYSQL_META,
  snowflake: SNOWFLAKE_META,
  bigquery: BIGQUERY_META,
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
