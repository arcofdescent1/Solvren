/**
 * Phase 7 — Timeline assembler service (§13).
 * Assembles issue and entity timelines with optional grouping.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevenueTimelineEvent } from "../domain/revenue-timeline-event";
import { getIssueTimeline } from "./revenue-timeline.service";

export type TimelineAssemblerOptions = {
  limit?: number;
  groupWindowMinutes?: number;
};

export async function assembleIssueTimeline(
  supabase: SupabaseClient,
  issueId: string,
  options?: TimelineAssemblerOptions
): Promise<{ events: RevenueTimelineEvent[]; error: Error | null }> {
  return getIssueTimeline(supabase, issueId, { limit: options?.limit ?? 200 });
}
