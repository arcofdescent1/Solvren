/**
 * Phase 1 — minimum OAuth scopes per provider (source of truth for connect flows).
 * Expand as providers are hardened.
 */

export type ProviderScopeProfile = {
  provider: string;
  required: string[];
  optional: string[];
  notes?: string;
};

export const INTEGRATION_SCOPE_REGISTRY: ProviderScopeProfile[] = [
  {
    provider: "slack",
    required: ["channels:read", "chat:write", "commands"],
    optional: ["users:read.email"],
    notes: "Request least privilege for workspace posting only.",
  },
  {
    provider: "github",
    required: ["repo", "read:org"],
    optional: ["read:user"],
    notes: "Avoid admin:org unless enterprise features require it.",
  },
  {
    provider: "jira",
    required: ["read:jira-work", "write:jira-work", "offline_access"],
    optional: [],
    notes: "Atlassian OAuth — align with Jira project access only.",
  },
  {
    provider: "hubspot",
    required: ["crm.objects.contacts.read", "crm.objects.deals.read", "oauth"],
    optional: [],
    notes: "Add write scopes only when playbooks require mutation.",
  },
  {
    provider: "salesforce",
    required: ["api", "refresh_token", "offline_access"],
    optional: [],
    notes: "Use integration user with narrow profile/permission set in Salesforce.",
  },
  {
    provider: "netsuite",
    required: ["restlets", "rest_webservices"],
    optional: [],
    notes: "Token exchange server-side only; rotate on role change.",
  },
];

export function getScopeProfile(provider: string): ProviderScopeProfile | undefined {
  return INTEGRATION_SCOPE_REGISTRY.find((p) => p.provider === provider.toLowerCase());
}
