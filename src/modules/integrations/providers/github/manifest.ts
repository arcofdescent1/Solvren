/**
 * Phase 1 — GitHub connector manifest (§14.6).
 * Tier 2: Engineering, GitHub App, manifest + health.
 */
import type { ConnectorManifest } from "../../contracts";

export function getGitHubManifest(): ConnectorManifest {
  return {
    provider: "github",
    displayName: "GitHub",
    category: "engineering",
    description: "Connect repositories and pull requests for change and deployment context.",
    authType: "oauth2",
    supportedSyncModes: ["polling", "webhook", "hybrid"],
    capabilities: ["read_objects", "receive_events", "health_checks", "schema_discovery"],
    supportedObjectTypes: ["repositories", "pull_requests", "commits"],
    supportedInboundEvents: ["pull_request", "push", "repository"],
    supportedOutboundActions: [],
    requiredScopes: ["repo", "read:org"],
    optionalScopes: ["workflow"],
    installPrerequisites: ["GitHub account", "GitHub App or OAuth App"],
    docsUrl: "https://docs.github.com/en/rest",
    iconAssetKey: "github",
    healthCheckStrategy: "api_probe",
    minimumPlan: "growth",
    isTierOne: false,
  };
}
