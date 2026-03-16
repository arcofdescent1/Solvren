import type { SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";

export async function markRevenueImpactStale(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  actorUserId?: string | null;
  reason: string;
}): Promise<void> {
  await addTimelineEvent({
    supabase: args.supabase,
    orgId: args.orgId,
    changeEventId: args.changeId,
    actorUserId: args.actorUserId ?? null,
    eventType: "REVENUE_IMPACT_REPORT_MARKED_STALE",
    title: "Revenue Impact Report marked stale",
    description: args.reason,
    metadata: { reason: args.reason, kind: "REVENUE_IMPACT_REPORT_MARKED_STALE" },
  });
}
