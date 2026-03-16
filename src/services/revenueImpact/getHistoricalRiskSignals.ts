import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricalRiskSignals, SignalStrength } from "./revenueImpactTypes";

function overlapCount(a: string[], b: string[]) {
  const as = new Set(a.map((x) => x.toLowerCase()));
  let c = 0;
  for (const x of b) {
    if (as.has(x.toLowerCase())) c += 1;
  }
  return c;
}

function strengthFromRate(rate: number): SignalStrength {
  if (rate >= 0.2) return "HIGH";
  if (rate >= 0.08) return "MEDIUM";
  return "LOW";
}

export async function getHistoricalRiskSignals(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  changeType: string | null;
  domain: string | null;
  systems: string[];
  revenueImpactAreas: string[];
}): Promise<HistoricalRiskSignals> {
  const since = new Date();
  since.setMonth(since.getMonth() - 18);

  const { data: similarChanges } = await args.supabase
    .from("change_events")
    .select("id, change_type, structured_change_type, domain, systems_involved, revenue_impact_areas")
    .eq("org_id", args.orgId)
    .neq("id", args.changeId)
    .gte("created_at", since.toISOString())
    .limit(500);

  const candidates = (similarChanges ?? []).filter((c) => {
    const changeType = String(c.structured_change_type ?? c.change_type ?? "").toLowerCase();
    const sameType = args.changeType ? changeType.includes(args.changeType.toLowerCase()) : false;
    const sameDomain = args.domain ? String(c.domain ?? "").toLowerCase() === args.domain.toLowerCase() : false;
    const sysOverlap = overlapCount(args.systems, Array.isArray(c.systems_involved) ? c.systems_involved : []) > 0;
    const areaOverlap =
      overlapCount(
        args.revenueImpactAreas,
        Array.isArray(c.revenue_impact_areas) ? c.revenue_impact_areas : []
      ) > 0;
    return sameType || sameDomain || sysOverlap || areaOverlap;
  });

  const candidateIds = candidates.map((c) => c.id as string).filter(Boolean);

  let incidentCount = 0;
  if (candidateIds.length > 0) {
    const { data: incidents } = await args.supabase
      .from("incidents")
      .select("id, change_event_id")
      .in("change_event_id", candidateIds);
    incidentCount = (incidents ?? []).length;
  }

  const similarChangeCount = candidates.length;
  const incidentRate = similarChangeCount > 0 ? incidentCount / similarChangeCount : 0;
  const strength = strengthFromRate(incidentRate);

  return {
    similarChangeCount,
    incidentCount,
    incidentRate,
    topSignals: similarChangeCount
      ? [
          {
            signalKey: "similar_change_incident_rate",
            description: `Similar changes had incidents in ${incidentCount} of ${similarChangeCount} cases`,
            strength,
          },
        ]
      : [],
  };
}
