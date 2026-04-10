export const OUTCOME_TYPES = [
  "APPROVAL_DELAY_AVOIDED",
  "RELEASE_BLOCKER_AVOIDED",
  "REVENUE_INCIDENT_AVOIDED",
  "MAJOR_OUTAGE_AVOIDED",
  "APPROVAL_TIME_SAVED",
  "READINESS_IMPROVED",
] as const;

export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export const CONFIDENCE_LEVELS = ["ESTIMATED", "LIKELY", "HIGH_CONFIDENCE", "VERIFIED"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const STORY_STATUSES = ["PENDING", "ACTIVE", "REJECTED"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const DEFAULT_OBSERVATION_DAYS: Record<OutcomeType, number> = {
  APPROVAL_DELAY_AVOIDED: 3,
  RELEASE_BLOCKER_AVOIDED: 7,
  REVENUE_INCIDENT_AVOIDED: 14,
  MAJOR_OUTAGE_AVOIDED: 30,
  APPROVAL_TIME_SAVED: 3,
  READINESS_IMPROVED: 7,
};

/** duration_factor in revenue formula per Phase 6 */
export const DURATION_FACTOR_BY_OUTCOME: Record<OutcomeType, number> = {
  APPROVAL_DELAY_AVOIDED: 0.1,
  RELEASE_BLOCKER_AVOIDED: 0.25,
  REVENUE_INCIDENT_AVOIDED: 1.0,
  MAJOR_OUTAGE_AVOIDED: 3.0,
  APPROVAL_TIME_SAVED: 0.1,
  READINESS_IMPROVED: 0.25,
};

export const PREVENTION_CONFIDENCE_BY_LEVEL: Record<ConfidenceLevel, number> = {
  ESTIMATED: 0.25,
  LIKELY: 0.5,
  HIGH_CONFIDENCE: 0.75,
  VERIFIED: 1.0,
};

export type EvidenceJsonV1 = {
  schemaVersion: 1;
  predictionId: string | null;
  changeEventId: string;
  actions: Array<{ type: string; timestamp: string }>;
  timelineEvents: string[];
  observationWindow: { startedAt: string; endsAt: string };
  /** APPROVAL_TIME_SAVED automation */
  baselineHours?: number;
  actualHours?: number;
  hoursSaved?: number;
  baselineSampleSize?: number;
  baselineScope?: string;
  interventionTypes?: string[];
};

export function isOutcomeType(s: string): s is OutcomeType {
  return (OUTCOME_TYPES as readonly string[]).includes(s);
}

export function isConfidenceLevel(s: string): s is ConfidenceLevel {
  return (CONFIDENCE_LEVELS as readonly string[]).includes(s);
}

export function confidenceMeetsRollupThreshold(
  level: ConfidenceLevel,
  threshold: ConfidenceLevel
): boolean {
  const order: ConfidenceLevel[] = ["ESTIMATED", "LIKELY", "HIGH_CONFIDENCE", "VERIFIED"];
  return order.indexOf(level) >= order.indexOf(threshold);
}
