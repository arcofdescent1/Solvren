/**
 * HubSpot counts from raw_events — aligned with detectHubSpotForOrg logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const LEAD_STAGES = new Set(["lead", "marketingqualifiedlead"]);

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

function parseTs(s: unknown): number | null {
  if (s == null || s === "") return null;
  const t = new Date(String(s)).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function fetchHubSpotRaw(supabase: SupabaseClient, orgId: string): Promise<RawEv[]> {
  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "hubspot");
  if (error) throw new Error(error.message);
  return (rows ?? []) as RawEv[];
}

export function countNoFollowUpLeads(evs: RawEv[], nowMs: number): number {
  const contacts = evs.filter((e) => e.event_type === "hubspot_contact");
  let noFollow = 0;
  for (const e of contacts) {
    const p = e.payload_json;
    const stage = String(p.lifecyclestage ?? "").toLowerCase();
    if (!LEAD_STAGES.has(stage)) continue;
    const act = Math.max(
      parseTs(p.hs_last_sales_activity_timestamp) ?? 0,
      parseTs(p.notes_last_contacted) ?? 0
    );
    const activeOk = act > 0 && nowMs - act < THREE_DAYS_MS;
    if (activeOk) continue;
    noFollow += 1;
  }
  return noFollow;
}

export function countStalledDeals(evs: RawEv[], nowMs: number): number {
  const deals = evs.filter((e) => e.event_type === "hubspot_deal");
  let stalled = 0;
  for (const e of deals) {
    const p = e.payload_json;
    const closed = String(p.hs_is_closed ?? "").toLowerCase() === "true";
    if (closed) continue;
    const mod = parseTs(p.hs_lastmodifieddate);
    if (mod == null || nowMs - mod < FOURTEEN_DAYS_MS) continue;
    stalled += 1;
  }
  return stalled;
}
