/**
 * Phase 3 — Replay scope resolver.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReplayScope =
  | { type: "record"; inboundEventId?: string; rawEventId?: string }
  | { type: "job"; syncJobId: string }
  | { type: "time_range"; provider: string; objectType: string; startTime: string; endTime: string }
  | { type: "full_source"; integrationAccountId: string; objectType: string };

export function parseScope(scopeType: string, scopeJson: Record<string, unknown>): ReplayScope | { error: string } {
  switch (scopeType) {
    case "record":
      return {
        type: "record",
        inboundEventId: scopeJson.inboundEventId as string | undefined,
        rawEventId: scopeJson.rawEventId as string | undefined,
      };
    case "job":
      const syncJobId = scopeJson.syncJobId as string;
      if (!syncJobId) return { error: "syncJobId required for job scope" };
      return { type: "job", syncJobId };
    case "time_range":
      const provider = scopeJson.provider as string;
      const objectType = scopeJson.objectType as string;
      const startTime = scopeJson.startTime as string;
      const endTime = scopeJson.endTime as string;
      if (!provider || !objectType || !startTime || !endTime) {
        return { error: "provider, objectType, startTime, endTime required for time_range scope" };
      }
      return { type: "time_range", provider, objectType, startTime, endTime };
    case "full_source":
      const integrationAccountId = scopeJson.integrationAccountId as string;
      const objType = scopeJson.objectType as string;
      if (!integrationAccountId || !objType) {
        return { error: "integrationAccountId and objectType required for full_source scope" };
      }
      return { type: "full_source", integrationAccountId, objectType: objType };
    default:
      return { error: `Unknown scope type: ${scopeType}` };
  }
}

export async function resolveRecordsToReplay(
  supabase: SupabaseClient,
  scope: ReplayScope
): Promise<{ rawEventIds: string[]; error?: string }> {
  if (scope.type === "record" && scope.rawEventId) {
    return { rawEventIds: [scope.rawEventId] };
  }
  if (scope.type === "record" && scope.inboundEventId) {
    return { rawEventIds: [], error: "inboundEventId replay uses integration_inbound_events pipeline; use rawEventId for raw_events" };
  }
  if (scope.type === "time_range") {
    const { data } = await supabase
      .from("raw_events")
      .select("id")
      .eq("provider", scope.provider)
      .eq("external_object_type", scope.objectType)
      .gte("received_at", scope.startTime)
      .lte("received_at", scope.endTime)
      .limit(10000);
    const ids = (data ?? []).map((r) => (r as { id: string }).id);
    return { rawEventIds: ids };
  }
  return { rawEventIds: [], error: "Scope not yet supported for bulk resolve" };
}
