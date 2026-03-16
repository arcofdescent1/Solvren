import type { SupabaseClient } from "@supabase/supabase-js";

function safeDiv(a: number, b: number) {
  return b <= 0 ? 0 : a / b;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeLearnedMultiplier(args: {
  totalChanges: number;
  incidentChanges: number;
  totalRevenueAtRisk: number;
  incidentRevenueAtRisk: number;
}) {
  const {
    totalChanges,
    incidentChanges,
    totalRevenueAtRisk,
    incidentRevenueAtRisk,
  } = args;

  const MIN_SAMPLES = 20;
  const MIN_INCIDENTS = 2;

  const incidentRate = safeDiv(incidentChanges, totalChanges);
  const revenueIncidentRate = safeDiv(
    incidentRevenueAtRisk,
    totalRevenueAtRisk
  );

  if (totalChanges < MIN_SAMPLES || incidentChanges < MIN_INCIDENTS) {
    return {
      learnedMultiplier: 1.0,
      reason: {
        mode: "INSUFFICIENT_DATA",
        totalChanges,
        incidentChanges,
        incidentRate,
        totalRevenueAtRisk,
        incidentRevenueAtRisk,
        revenueIncidentRate,
      },
    };
  }

  const baselineIncident = 0.05;
  const baselineRevenueRate = 0.1;

  const freqLift = clamp(safeDiv(incidentRate, baselineIncident), 0.5, 3.0);
  const revLift = clamp(
    safeDiv(revenueIncidentRate, baselineRevenueRate),
    0.5,
    3.0
  );

  const blended = 0.4 * freqLift + 0.6 * revLift;
  const learnedMultiplier = clamp(blended, 0.7, 1.6);

  return {
    learnedMultiplier,
    reason: {
      mode: "LEARNED",
      totalChanges,
      incidentChanges,
      incidentRate,
      totalRevenueAtRisk,
      incidentRevenueAtRisk,
      revenueIncidentRate,
      freqLift,
      revLift,
      blended,
      caps: { min: 0.7, max: 1.6 },
    },
  };
}

export async function recomputeSignalStatsRevenueAware(
  supabaseAdmin: SupabaseClient,
  args: { orgId: string; domain?: string; modelVersion?: number }
) {
  const { orgId, domain = "REVENUE", modelVersion = 1 } = args;

  const { data: changes, error } = await supabaseAdmin
    .from("change_events")
    .select("id, revenue_at_risk, domain")
    .eq("org_id", orgId)
    .eq("domain", domain);

  if (error) throw new Error(error.message);

  const { data: incidents, error: incErr } = await supabaseAdmin
    .from("incidents")
    .select("id, change_event_id")
    .eq("org_id", orgId);

  if (incErr) throw new Error(incErr.message);

  const incidentByChange = new Set<string>(
    (incidents ?? []).map((i: { change_event_id?: string }) => i.change_event_id).filter((x): x is string => Boolean(x))
  );

  const changeIds = (changes ?? []).map((c: { id: string }) => c.id).filter(Boolean);
  if (changeIds.length === 0) {
    return { signals: 0 };
  }

  const { data: signals, error: sigErr } = await supabaseAdmin
    .from("risk_signals")
    .select("change_event_id, signal_key")
    .in("change_event_id", changeIds)
    .eq("domain", domain);

  if (sigErr) throw new Error(sigErr.message);

  const changeByRev = new Map<string, number>();
  for (const c of changes ?? []) {
    const id = String((c as { id: string }).id);
    const rar = Number((c as { revenue_at_risk?: number }).revenue_at_risk ?? 0);
    changeByRev.set(id, rar);
  }

  const agg: Record<
    string,
    {
      changeIds: Set<string>;
      incidentChangeIds: Set<string>;
      revenueByChange: Map<string, number>;
    }
  > = {};

  for (const s of signals ?? []) {
    const changeId = String((s as { change_event_id: string }).change_event_id);
    const signalKey = String((s as { signal_key: string }).signal_key);
    const revenueAtRisk = changeByRev.get(changeId) ?? 0;
    const isIncident = incidentByChange.has(changeId);

    if (!agg[signalKey]) {
      agg[signalKey] = {
        changeIds: new Set(),
        incidentChangeIds: new Set(),
        revenueByChange: new Map(),
      };
    }

    agg[signalKey].changeIds.add(changeId);
    agg[signalKey].revenueByChange.set(changeId, revenueAtRisk);
    if (isIncident) {
      agg[signalKey].incidentChangeIds.add(changeId);
    }
  }

  const flattened: Record<
    string,
    {
      totalChanges: number;
      incidentChanges: number;
      totalRevenueAtRisk: number;
      incidentRevenueAtRisk: number;
    }
  > = {};

  for (const [signalKey, a] of Object.entries(agg)) {
    let totalRevenueAtRisk = 0;
    let incidentRevenueAtRisk = 0;
    for (const cid of a.changeIds) {
      totalRevenueAtRisk += a.revenueByChange.get(cid) ?? 0;
      if (a.incidentChangeIds.has(cid)) {
        incidentRevenueAtRisk += a.revenueByChange.get(cid) ?? 0;
      }
    }
    flattened[signalKey] = {
      totalChanges: a.changeIds.size,
      incidentChanges: a.incidentChangeIds.size,
      totalRevenueAtRisk,
      incidentRevenueAtRisk,
    };
  }

  for (const [signalKey, a] of Object.entries(flattened)) {
    const incidentRate = a.totalChanges > 0 ? a.incidentChanges / a.totalChanges : 0;
    const revenueIncidentRate =
      a.totalRevenueAtRisk > 0
        ? a.incidentRevenueAtRisk / a.totalRevenueAtRisk
        : 0;

    const { learnedMultiplier, reason } = computeLearnedMultiplier({
      totalChanges: a.totalChanges,
      incidentChanges: a.incidentChanges,
      totalRevenueAtRisk: a.totalRevenueAtRisk,
      incidentRevenueAtRisk: a.incidentRevenueAtRisk,
    });

    await supabaseAdmin.from("signal_stats").upsert(
      {
        org_id: orgId,
        domain,
        signal_key: signalKey,
        model_version: modelVersion,
        total_changes: a.totalChanges,
        incident_changes: a.incidentChanges,
        total_revenue_at_risk: a.totalRevenueAtRisk,
        incident_revenue_at_risk: a.incidentRevenueAtRisk,
        incident_rate: incidentRate,
        revenue_incident_rate: revenueIncidentRate,
        learned_multiplier: learnedMultiplier,
        learned_multiplier_reason: reason,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "org_id,domain,signal_key,model_version",
      }
    );
  }

  return { signals: Object.keys(flattened).length };
}
