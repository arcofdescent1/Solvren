/**
 * IntegrationRegistry — capability declarations per provider.
 * UI and backend use this for consistent decisions without provider-specific branching.
 */
import type { IntegrationCapability, IntegrationProvider } from "./types";

const REGISTRY: Record<IntegrationProvider, IntegrationCapability> = {
  jira: {
    provider: "jira",
    supportsOauth: true,
    supportsWebhooks: true,
    supportsRetry: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
    supportsComments: true,
    supportsStatusSync: true,
  },
  github: {
    provider: "github",
    supportsOauth: false, // Uses GitHub App installation flow
    supportsWebhooks: true,
    supportsRetry: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
  },
  slack: {
    provider: "slack",
    supportsOauth: true,
    supportsWebhooks: false, // Uses interactions/deliveries
    supportsRetry: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
  },
  hubspot: {
    provider: "hubspot",
    supportsOauth: true,
    supportsWebhooks: true,
    supportsValidation: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
  },
  netsuite: {
    provider: "netsuite",
    supportsOauth: false, // Machine auth
    supportsValidation: true,
    supportsRetry: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
  },
  salesforce: {
    provider: "salesforce",
    supportsOauth: true,
    supportsValidation: true,
    supportsHealthCheck: true,
    supportsManualTest: true,
    supportsDisconnect: true,
  },
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  "jira",
  "github",
  "slack",
  "hubspot",
  "netsuite",
  "salesforce",
];

export function getCapabilities(provider: IntegrationProvider): IntegrationCapability {
  return REGISTRY[provider] ?? { provider };
}

export function getAllCapabilities(): Record<IntegrationProvider, IntegrationCapability> {
  return { ...REGISTRY };
}

export function hasCapability(
  provider: IntegrationProvider,
  cap: keyof IntegrationCapability
): boolean {
  const c = REGISTRY[provider];
  if (!c) return false;
  const v = c[cap];
  return v === true;
}
