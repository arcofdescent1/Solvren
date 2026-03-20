/**
 * Phase 7 — Revenue timeline service (§11).
 * Single write path for all timeline events. Append-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RevenueTimelineEvent,
  RevenueTimelineEventInput,
  ValueType,
} from "../domain/revenue-timeline-event";
import { RevenueTimelineEventType } from "../domain/revenue-timeline-event-type";
import { insertTimelineEvent } from "../repositories/revenue-timeline-events.repository";
import { listEventsByIssue } from "../repositories/revenue-timeline-events.repository";
import { listEventsByEntity } from "../repositories/revenue-timeline-events.repository";
import { listEventsByOrg } from "../repositories/revenue-timeline-events.repository";
import type { RevenueTimelineEventRow } from "../repositories/revenue-timeline-events.repository";

function rowToEvent(row: RevenueTimelineEventRow): RevenueTimelineEvent {
  return {
    eventId: row.id,
    orgId: row.org_id,
    issueId: row.issue_id,
    findingId: row.finding_id,
    workflowRunId: row.workflow_run_id,
    primaryEntityType: row.primary_entity_type,
    primaryEntityId: row.primary_entity_id,
    category: row.category as RevenueTimelineEvent["category"],
    eventType: row.event_type as RevenueTimelineEventType,
    headline: row.headline,
    summary: row.summary,
    amount: row.amount,
    currencyCode: row.currency_code,
    valueType: row.value_type as ValueType | null,
    actorType: row.actor_type as RevenueTimelineEvent["actorType"],
    actorUserId: row.actor_user_id,
    sourceModule: row.source_module as RevenueTimelineEvent["sourceModule"],
    sourceRefId: row.source_ref_id,
    status: row.status as RevenueTimelineEvent["status"],
    detailPayloadJson: row.detail_payload_json ?? {},
    displayPriority: row.display_priority,
    eventTime: row.event_time,
    createdAt: row.created_at,
  };
}

function validateInput(input: RevenueTimelineEventInput): string | null {
  if (!input.headline?.trim()) return "headline required";
  if (!input.summary?.trim()) return "summary required";
  if (!input.eventType) return "eventType required";
  if (!input.category) return "category required";
  if (!input.eventTime) return "eventTime required";
  if (!input.orgId) return "orgId required";

  if (input.valueType != null) {
    if (input.amount == null) return "amount required when valueType present";
    if (!input.currencyCode?.trim()) return "currencyCode required when valueType present";
  }

  if (input.eventType === RevenueTimelineEventType.REVENUE_RECOVERED) {
    if (input.valueType !== "RECOVERED") return "valueType must be RECOVERED for REVENUE_RECOVERED";
  }
  if (input.eventType === RevenueTimelineEventType.LOSS_AVOIDED) {
    if (input.valueType !== "AVOIDED") return "valueType must be AVOIDED for LOSS_AVOIDED";
  }

  return null;
}

export async function appendTimelineEvent(
  supabase: SupabaseClient,
  input: RevenueTimelineEventInput
): Promise<{ eventId: string | null; error: Error | null }> {
  const err = validateInput(input);
  if (err) return { eventId: null, error: new Error(err) };

  const { data, error } = await insertTimelineEvent(supabase, {
    org_id: input.orgId,
    issue_id: input.issueId ?? null,
    finding_id: input.findingId ?? null,
    workflow_run_id: input.workflowRunId ?? null,
    primary_entity_type: input.primaryEntityType ?? null,
    primary_entity_id: input.primaryEntityId ?? null,
    category: input.category,
    event_type: input.eventType,
    headline: input.headline,
    summary: input.summary,
    amount: input.amount ?? null,
    currency_code: input.currencyCode ?? null,
    value_type: input.valueType ?? null,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? null,
    source_module: input.sourceModule,
    source_ref_id: input.sourceRefId ?? null,
    status: input.status ?? null,
    detail_payload_json: input.detailPayloadJson ?? {},
    display_priority: input.displayPriority ?? 50,
    event_time: input.eventTime,
  });

  if (error) return { eventId: null, error };
  return { eventId: data?.id ?? null, error: null };
}

export async function getIssueTimeline(
  supabase: SupabaseClient,
  issueId: string,
  options?: { limit?: number }
): Promise<{ events: RevenueTimelineEvent[]; error: Error | null }> {
  const { data, error } = await listEventsByIssue(supabase, issueId, options);
  if (error) return { events: [], error };
  return {
    events: data.map(rowToEvent),
    error: null,
  };
}

export async function getEntityTimeline(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  options?: { limit?: number }
): Promise<{ events: RevenueTimelineEvent[]; error: Error | null }> {
  const { data, error } = await listEventsByEntity(
    supabase,
    entityType,
    entityId,
    options
  );
  if (error) return { events: [], error };
  return {
    events: data.map(rowToEvent),
    error: null,
  };
}

export async function getRevenueFeed(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    limit?: number;
    minDisplayPriority?: number;
    windowDays?: number;
  }
): Promise<{ events: RevenueTimelineEvent[]; error: Error | null }> {
  const windowDays = options?.windowDays ?? 30;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - windowDays);

  const { data, error } = await listEventsByOrg(supabase, orgId, {
    limit: options?.limit ?? 50,
    minDisplayPriority: options?.minDisplayPriority,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  });
  if (error) return { events: [], error };
  return {
    events: data.map(rowToEvent),
    error: null,
  };
}
