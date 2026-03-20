/**
 * Phase 1 — ConnectorManifest (§6.2).
 * Declarative metadata for install flows, permissions, and UI.
 */

import type {
  IntegrationProvider,
  AuthType,
  SyncMode,
  CapabilityType,
  IntegrationCategory,
  HealthCheckStrategy,
  MinimumPlan,
} from "./types";

export interface ConnectorManifest {
  provider: IntegrationProvider;
  displayName: string;
  category: IntegrationCategory;
  description: string;
  authType: AuthType;
  supportedSyncModes: SyncMode[];
  capabilities: CapabilityType[];
  supportedObjectTypes: string[];
  supportedInboundEvents: string[];
  supportedOutboundActions: string[];
  requiredScopes: string[];
  optionalScopes: string[];
  installPrerequisites: string[];
  docsUrl?: string;
  iconAssetKey: string;
  healthCheckStrategy: HealthCheckStrategy;
  minimumPlan: MinimumPlan;
  isTierOne: boolean;
}
