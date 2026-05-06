import type { SupabaseClient } from "@supabase/supabase-js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const CLOSED = new Set(["Closed Won", "Closed Lost"]);

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

export async function fetchSalesforceRaw(supabase: SupabaseClient, orgId: string): Promise<RawEv[]> {
  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "salesforce");
  if (error) throw new Error(error.message);
  return (rows ?? []) as RawEv[];
}

export function countStaleOpportunities(evs: RawEv[], nowMs: number): number {
  const opps = evs.filter((e) => e.event_type === "sf_opportunity");
  let stale = 0;
  for (const e of opps) {
    const p = e.payload_json;
    const stage = String(p.StageName ?? "");
    if (CLOSED.has(stage)) continue;
    const lm = new Date(String(p.LastModifiedDate ?? "")).getTime();
    if (!Number.isFinite(lm) || nowMs - lm < FOURTEEN_DAYS_MS) continue;
    stale += 1;
  }
  return stale;
}
