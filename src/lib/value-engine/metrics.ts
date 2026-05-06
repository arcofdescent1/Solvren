import type { SupabaseClient } from "@supabase/supabase-js";

/** Record first integration connection time for time_to_first_issue (additive). */
export async function recordFirstIntegrationConnected(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data: row } = await supabase
    .from("value_engine_org_metrics")
    .select("first_integration_connected_at")
    .eq("org_id", orgId)
    .maybeSingle();

  const existing = (row as { first_integration_connected_at?: string } | null)?.first_integration_connected_at;
  if (existing) return;

  await supabase.from("value_engine_org_metrics").upsert(
    {
      org_id: orgId,
      first_integration_connected_at: now,
      updated_at: now,
    },
    { onConflict: "org_id" }
  );
}
