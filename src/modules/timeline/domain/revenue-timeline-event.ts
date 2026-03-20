/**
 * Phase 7 — Revenue timeline event contract (§6.3).
 */
import type { RevenueTimelineEventCategory } from "./revenue-timeline-category";
import type { RevenueTimelineEventType } from "./revenue-timeline-event-type";

export type ValueType = "RECOVERED" | "AVOIDED" | "LOSS" | "SAVINGS";
export type ActorType = "system" | "user" | "workflow" | "connector" | "verification_engine";
export type SourceModule =
  | "detectors"
  | "impact"
  | "decision"
  | "policy"
  | "execution"
  | "verification"
  | "roi"
  | "issues";
export type EventStatus = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export type RevenueTimelineEvent = {
  eventId: string;
  orgId: string;

  issueId?: string | null;
  findingId?: string | null;
  workflowRunId?: string | null;

  primaryEntityType?: string | null;
  primaryEntityId?: string | null;

  category: RevenueTimelineEventCategory;
  eventType: RevenueTimelineEventType;

  headline: string;
  summary: string;

  amount?: number | null;
  currencyCode?: string | null;
  valueType?: ValueType | null;

  actorType: ActorType;
  actorUserId?: string | null;

  sourceModule: SourceModule;
  sourceRefId?: string | null;

  status?: EventStatus | null;

  detailPayloadJson: Record<string, unknown>;
  displayPriority: number;

  eventTime: string;
  createdAt: string;
};

export type RevenueTimelineEventInput = Omit<
  RevenueTimelineEvent,
  "eventId" | "createdAt"
> & {
  eventTime: string;
};
