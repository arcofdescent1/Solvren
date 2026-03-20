/**
 * Phase 1 — Get provider manifest for UI and install flows.
 * §20.2 getProviderManifest.
 */

import type { ConnectorManifest } from "../contracts";
import { getRegistryManifest, hasProvider, INTEGRATION_PROVIDERS_PHASE1 } from "./providerRegistry";
import type { IntegrationProvider } from "../contracts/types";

export function getProviderManifest(provider: string): ConnectorManifest | null {
  if (!hasProvider(provider)) return null;
  return getRegistryManifest(provider as IntegrationProvider);
}

export function getAllManifests(): ConnectorManifest[] {
  return INTEGRATION_PROVIDERS_PHASE1.map((p) => getRegistryManifest(p));
}
