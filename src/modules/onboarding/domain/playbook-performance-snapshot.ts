/**
 * Phase 10 — Playbook performance and health (§14).
 */
export enum PlaybookHealthState {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  BLOCKED = "BLOCKED",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}

export type PlaybookPerformanceSnapshot = {
  id: string;
  orgId: string;
  playbookKey: string;
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  partialSuccessCount: number;
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount: number;
  realizedLossAmount: number;
  avgTimeToResolutionSeconds?: number | null;
  verificationSuccessRate?: number | null;
  automationRate?: number | null;
  approvalRate?: number | null;
  performanceScore: number;
  healthState: PlaybookHealthState;
  reasonsJson: string[];
  metricsJson: Record<string, unknown>;
  createdAt: string;
};
