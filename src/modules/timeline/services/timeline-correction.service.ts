/**
 * Phase 7 — Timeline correction service (§16).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendTimelineEvent } from "./revenue-timeline.service";
import { insertCorrection } from "../repositories/timeline-event-corrections.repository";
import { RevenueTimelineEventType } from "../domain/revenue-timeline-event-type";
import { RevenueTimelineEventCategory } from "../domain/revenue-timeline-category";

export async function appendCorrection(
  supabase: SupabaseClient,
  orgId: string,
  originalEventId: string,
  correctionInput: {
    headline: string;
    summary: string;
    reason: string;
    issueId?: string | null;
    detailPayloadJson?: Record<string, unknown>;
  }
): Promise<{ correctionEventId: string | null; error: Error | null }> {
  const eventTime = new Date().toISOString();
  const { eventId: correctionEventId, error: appendErr } = await appendTimelineEvent(
    supabase,
    {
      orgId,
      issueId: correctionInput.issueId,
      category: RevenueTimelineEventCategory.SYSTEM,
      eventType: RevenueTimelineEventType.TIMELINE_CORRECTION,
      headline: correctionInput.headline,
      summary: correctionInput.summary,
      actorType: "system",
      sourceModule: "issues",
      detailPayloadJson: {
        ...correctionInput.detailPayloadJson,
        originalEventId,
        reason: correctionInput.reason,
      },
      displayPriority: 25,
      eventTime,
    }
  );

  if (appendErr || !correctionEventId) {
    return { correctionEventId: null, error: appendErr ?? new Error("Failed to append correction event") };
  }

  const { error: corrErr } = await insertCorrection(supabase, {
    org_id: orgId,
    original_event_id: originalEventId,
    correction_event_id: correctionEventId,
    reason: correctionInput.reason,
  });

  if (corrErr) return { correctionEventId, error: corrErr };
  return { correctionEventId, error: null };
}
