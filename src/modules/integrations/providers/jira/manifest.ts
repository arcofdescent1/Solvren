/**
 * Phase 1 — Jira connector manifest (§14.5).
 * Tier 1: Work management, OAuth/API token, create/update issue, comment.
 */
import type { ConnectorManifest } from "../../contracts";

export function getJiraManifest(): ConnectorManifest {
  return {
    provider: "jira",
    displayName: "Jira",
    category: "work_management",
    description: "Track remediation work through engineering workflows.",
    authType: "oauth2",
    supportedSyncModes: ["polling", "manual"],
    capabilities: [
      "read_objects",
      "execute_actions",
      "health_checks",
      "schema_discovery",
    ],
    supportedObjectTypes: ["issues", "projects", "users"],
    supportedInboundEvents: [],
    supportedOutboundActions: ["create_issue", "update_issue_status", "add_comment", "attach_issue_link"],
    requiredScopes: ["read:jira-work", "write:jira-work"],
    optionalScopes: ["read:jira-user"],
    installPrerequisites: ["Atlassian account", "Jira Cloud site"],
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3",
    iconAssetKey: "jira",
    healthCheckStrategy: "api_probe",
    minimumPlan: "starter",
    isTierOne: true,
  };
}
