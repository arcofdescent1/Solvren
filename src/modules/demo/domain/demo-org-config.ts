/**
 * Phase 8 — Demo System.
 * Demo org flags and configuration.
 */
export type DemoOrgConfig = {
  orgId: string;
  isDemoOrg: boolean;
  demoScenarioKey?: string | null;
  demoResetAllowed: boolean;
  demoAutoRefreshEnabled: boolean;
  demoExternalWriteDisabled: boolean;
  lastResetAt?: string | null;
  validationStatus?: string | null;
  createdAt: string;
  updatedAt: string;
};
