import type { SupabaseClient } from "@supabase/supabase-js";

export async function linkRiskEvents(
  client: SupabaseClient,
  orgId: string,
  sourceEventId: string,
  targetEventId: string,
  linkType: string
): Promise<void> {
  const { error } = await client
    .from("risk_event_links")
    .upsert(
      {
        org_id: orgId,
        source_event_id: sourceEventId,
        target_event_id: targetEventId,
        link_type: linkType,
      },
      { onConflict: "org_id,source_event_id,target_event_id,link_type" }
    );

  if (error) throw new Error(error.message);
}
