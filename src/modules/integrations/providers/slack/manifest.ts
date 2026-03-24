/**
 * Phase 1 — Slack connector manifest (§14.4).
 * Tier 1: Communication, OAuth, post message, threads.
 */
import type { ConnectorManifest } from "../../contracts";

export function getSlackManifest(): ConnectorManifest {
  return {
    provider: "slack",
    displayName: "Slack",
    category: "communication",
    description: "Route issues quickly to the teams who can fix them.",
    authType: "oauth2",
    supportedSyncModes: ["polling", "manual"],
    capabilities: ["execute_actions", "health_checks"],
    supportedObjectTypes: ["channels", "users"],
    supportedInboundEvents: [],
    supportedOutboundActions: ["post_message", "post_issue_summary"],
    requiredScopes: ["chat:write", "channels:read", "users:read"],
    optionalScopes: ["chat:write.public", "groups:read"],
    installPrerequisites: ["Slack workspace", "App installation"],
    docsUrl: "https://api.slack.com",
    iconAssetKey: "slack",
    healthCheckStrategy: "token_validation",
    minimumPlan: "starter",
    isTierOne: true,
  };
}
