/**
 * Phase 7 — Timeline event emitter. Call from source modules to append events.
 * Single write path: all modules must use appendTimelineEvent via this or the service.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendTimelineEvent } from "./revenue-timeline.service";
import {
  RevenueTimelineEventType,
  type RevenueTimelineEventCategory,
} from "../domain";

export async function emitIssueDetected(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId: string;
    findingId?: string | null;
    headline: string;
    summary: string;
    primaryEntityType?: string | null;
    primaryEntityId?: string | null;
    sourceRefId?: string | null;
  }
): Promise<{ eventId: string | null; error: Error | null }> {
  return appendTimelineEvent(supabase, {
    ...input,
    category: "DETECTION" as RevenueTimelineEventCategory,
    eventType: RevenueTimelineEventType.ISSUE_DETECTED,
    actorType: "system",
    sourceModule: "detectors",
    displayPriority: 75,
    eventTime: new Date().toISOString(),
    detailPayloadJson: {},
  });
}

export async function emitRevenueRecovered(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId: string;
    amount: number;
    currencyCode?: string;
    headline: string;
    summary: string;
    primaryEntityType?: string | null;
    primaryEntityId?: string | null;
    sourceRefId?: string | null;
  }
): Promise<{ eventId: string | null; error: Error | null }> {
  return appendTimelineEvent(supabase, {
    ...input,
    category: "OUTCOME" as RevenueTimelineEventCategory,
    eventType: RevenueTimelineEventType.REVENUE_RECOVERED,
    valueType: "RECOVERED",
    currencyCode: input.currencyCode ?? "USD",
    actorType: "system",
    sourceModule: "roi",
    displayPriority: 100,
    eventTime: new Date().toISOString(),
    detailPayloadJson: {},
  });
}

export async function emitLossAvoided(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId: string;
    amount: number;
    currencyCode?: string;
    headline: string;
    summary: string;
    primaryEntityType?: string | null;
    primaryEntityId?: string | null;
    sourceRefId?: string | null;
  }
): Promise<{ eventId: string | null; error: Error | null }> {
  return appendTimelineEvent(supabase, {
    ...input,
    category: "OUTCOME" as RevenueTimelineEventCategory,
    eventType: RevenueTimelineEventType.LOSS_AVOIDED,
    valueType: "AVOIDED",
    currencyCode: input.currencyCode ?? "USD",
    actorType: "system",
    sourceModule: "roi",
    displayPriority: 100,
    eventTime: new Date().toISOString(),
    detailPayloadJson: {},
  });
}

export async function emitOperationalSavings(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId: string;
    amount: number;
    currencyCode?: string;
    headline: string;
    summary: string;
    primaryEntityType?: string | null;
    primaryEntityId?: string | null;
    sourceRefId?: string | null;
  }
): Promise<{ eventId: string | null; error: Error | null }> {
  return appendTimelineEvent(supabase, {
    ...input,
    category: "OUTCOME" as RevenueTimelineEventCategory,
    eventType: RevenueTimelineEventType.OPERATIONAL_SAVINGS_RECORDED,
    valueType: "SAVINGS",
    currencyCode: input.currencyCode ?? "USD",
    actorType: "system",
    sourceModule: "roi",
    displayPriority: 75,
    eventTime: new Date().toISOString(),
    detailPayloadJson: {},
  });
}
