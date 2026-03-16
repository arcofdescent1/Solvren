import type { SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";

export async function markCoordinationPlanStale(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  actorUserId?: string | null;
  reason: string;
}) {
  await addTimelineEvent({
    supabase: args.supabase,
    orgId: args.orgId,
    changeEventId: args.changeId,
    actorUserId: args.actorUserId ?? null,
    eventType: "COORDINATION_PLAN_MARKED_STALE",
    title: "Coordination plan marked stale",
    description: args.reason,
    metadata: { reason: args.reason },
  });
}
