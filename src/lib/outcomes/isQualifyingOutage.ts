import type { SupabaseClient } from "@supabase/supabase-js";
import { hasDownstreamIncident } from "@/lib/outcomes/downstreamIncident";

/**
 * Qualifying outage during observation window (major-outage story rejection).
 */
export async function isQualifyingOutageDuringWindow(args: {
  admin: SupabaseClient;
  changeEventId: string;
  afterActionAt: string;
  windowEnd: string;
}): Promise<boolean> {
  return hasDownstreamIncident(args);
}
