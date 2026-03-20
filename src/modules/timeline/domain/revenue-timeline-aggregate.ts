/**
 * Phase 7 — Revenue timeline aggregate (§17).
 */
export type RevenueTimelineAggregate = {
  orgId: string;
  aggregateType: string;
  aggregateKey: string;
  windowStart: string;
  windowEnd: string;
  eventCount: number;
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount: number;
  lossAmount: number;
  metricsJson: Record<string, unknown>;
};
