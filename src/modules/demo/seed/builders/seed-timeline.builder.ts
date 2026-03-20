/**
 * Phase 8 — Timeline events seed builder.
 */
import { ts, seededUuid } from "./seed-helpers";

type RevenueTimelineEventInsert = Record<string, unknown>;

export type SeedTimelineInput = {
  orgId: string;
  issueId?: string | null;
  category: string;
  eventType: string;
  headline: string;
  summary: string;
  amount?: number | null;
  valueType?: string | null;
  daysAgo?: number;
};

export function buildSeedTimelineEvents(input: SeedTimelineInput[]): RevenueTimelineEventInsert[] {
  return input.map((e, idx) => {
    const daysAgo = e.daysAgo ?? 1;
    const eventId = seededUuid(`timeline:${e.orgId}:${e.headline}:${idx}`);

    return {
      id: eventId,
      org_id: e.orgId,
      issue_id: e.issueId ?? null,
      category: e.category,
      event_type: e.eventType,
      headline: e.headline,
      summary: e.summary,
      amount: e.amount ?? null,
      value_type: e.valueType ?? null,
      actor_type: "system",
      source_module: "demo_seed",
      source_ref_id: null,
      status: "completed",
      detail_payload_json: {} as Record<string, unknown>,
      display_priority: 50,
      event_time: ts(-daysAgo),
    } as RevenueTimelineEventInsert;
  });
}
