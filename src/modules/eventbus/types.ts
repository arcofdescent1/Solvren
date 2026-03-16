export type RiskBucket = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface CanonicalRiskEvent {
  id?: string;
  provider: string;
  object: string;
  objectId: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
  actor?: string;
  riskType: string;
  riskScore: number;
  riskBucket: RiskBucket;
  impactAmount?: number;
  changeEventId?: string;
  approvalId?: string;
  approvedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface RawIntegrationEvent {
  provider: string;
  object?: string;
  objectId?: string;
  field?: string;
  old?: unknown;
  new?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp?: string;
  actor?: string;
  riskType?: string;
  metadata?: Record<string, unknown>;
}
