import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 5: request async readiness/prediction recompute after a meaningful change update.
 * Safe to call from user-context routes (uses service role for queue write).
 */
export async function queueReadinessRecompute(args: { orgId: string; changeEventId: string }): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("readiness_recompute_queue").upsert(
    {
      org_id: args.orgId,
      change_event_id: args.changeEventId,
      requested_at: new Date().toISOString(),
    },
    { onConflict: "change_event_id" }
  );
  if (error && !String(error.message).includes("duplicate")) {
     
    console.warn("readiness_recompute_queue:", error.message);
  }
}

/** Fire-and-forget variant when you have only the user-scoped client (org resolved elsewhere). */
export async function queueReadinessRecomputeFromClient(
  _db: SupabaseClient,
  args: { orgId: string; changeEventId: string }
): Promise<void> {
  await queueReadinessRecompute(args);
}
