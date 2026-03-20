/**
 * Phase 8 — Demo System.
 * Reset run status.
 */
export type DemoResetStatus = "queued" | "running" | "completed" | "failed";

export type DemoOrgReset = {
  id: string;
  orgId: string;
  scenarioKey: string;
  seedVersion: string;
  resetStatus: DemoResetStatus;
  requestedByUserId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
};
