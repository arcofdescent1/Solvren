import type { SupabaseClient } from "@supabase/supabase-js";
import { betaPosteriorFromCounts, mitigationLiftBayes } from "@/services/risk/bayesian";
import { betaPosteriorFromEffectiveCounts } from "@/services/risk/bayesianDecay";
import { exposureBucketFromChange } from "@/services/risk/exposureBuckets";

function safeDiv(a: number, b: number) {
  return b <= 0 ? 0 : a / b;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function decayWeight(tsIso: string | null, halfLifeDays: number) {
  if (!tsIso) return 1;
  const t = new Date(tsIso).getTime();
  const ageDays = (Date.now() - t) / 86400000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 1;
  const lambda = Math.log(2) / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}

function computeLearnedMultiplierV2(args: {
  totalW: number;
  incidentW: number;
  totalRARW: number;
  incidentRARW: number;
  realizedMrrW: number;
  mitigationEffectiveness: number;
}) {
  const {
    totalW,
    incidentW,
    totalRARW,
    incidentRARW,
    realizedMrrW,
    mitigationEffectiveness,
  } = args;

  const MIN_TOTAL_W = 20;
  const MIN_INC_W = 2;

  const incidentRate = safeDiv(incidentW, totalW);
  const revenueIncidentRate = safeDiv(incidentRARW, totalRARW);

  if (totalW < MIN_TOTAL_W || incidentW < MIN_INC_W) {
    return {
      learnedMultiplier: 1.0,
      reason: {
        mode: "INSUFFICIENT_DATA",
        totalW,
        incidentW,
        incidentRate,
        totalRARW,
        incidentRARW,
        revenueIncidentRate,
      },
    };
  }

  const baseIncident = 0.05;
  const baseRev = 0.1;

  const freqLift = clamp(safeDiv(incidentRate, baseIncident), 0.5, 3.0);
  const revLift = clamp(safeDiv(revenueIncidentRate, baseRev), 0.5, 3.0);
  const severityLift = clamp(
    safeDiv(realizedMrrW, Math.max(1, incidentRARW)),
    0.8,
    1.5
  );
  const mitigationDampener = clamp(
    1 - 0.25 * mitigationEffectiveness,
    0.75,
    1.0
  );

  const blended =
    (0.35 * freqLift + 0.45 * revLift + 0.2 * severityLift) * mitigationDampener;
  const learnedMultiplier = clamp(blended, 0.7, 1.6);

  return {
    learnedMultiplier,
    reason: {
      mode: "LEARNED_V2",
      totalW,
      incidentW,
      incidentRate,
      totalRARW,
      incidentRARW,
      revenueIncidentRate,
      realizedMrrW,
      freqLift,
      revLift,
      severityLift,
      mitigationEffectiveness,
      mitigationDampener,
      blended,
      caps: { min: 0.7, max: 1.6 },
    },
  };
}

export async function recomputeSignalStatsV2(
  supabaseAdmin: SupabaseClient,
  args: {
    orgId: string;
    domain?: string;
    modelVersion?: number;
    windowDays?: number;
    halfLifeDays?: number;
  }
) {
  const {
    orgId,
    domain = "REVENUE",
    modelVersion = 1,
    windowDays = 180,
    halfLifeDays = 60,
  } = args;
  const sinceIso = new Date(
    Date.now() - windowDays * 86400000
  ).toISOString();

  const { data: changes, error } = await supabaseAdmin
    .from("change_events")
    .select("id, revenue_at_risk, submitted_at, estimated_mrr_affected, percent_customer_base_affected")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .gte("submitted_at", sinceIso);

  if (error) throw new Error(error.message);

  const changeIds = (changes ?? []).map((c: { id: string }) => c.id).filter(Boolean);
  if (changeIds.length === 0) {
    return { signals: 0, windowDays, halfLifeDays };
  }

  const { data: incidents, error: incErr } = await supabaseAdmin
    .from("incidents")
    .select("id, change_event_id, realized_mrr_impact, realized_revenue_impact")
    .eq("org_id", orgId);

  if (incErr) throw new Error(incErr.message);

  const incidentByChange = new Map<
    string,
    { realizedMrr: number; realizedRev: number }
  >();
  for (const i of incidents ?? []) {
    const cid = (i as { change_event_id?: string }).change_event_id;
    if (!cid) continue;
    incidentByChange.set(cid, {
      realizedMrr: Number((i as { realized_mrr_impact?: number }).realized_mrr_impact ?? 0),
      realizedRev: Number((i as { realized_revenue_impact?: number }).realized_revenue_impact ?? 0),
    });
  }

  const { data: cmas, error: cmaErr } = await supabaseAdmin
    .from("change_mitigation_actions")
    .select("change_event_id, signal_key, status")
    .eq("org_id", orgId)
    .eq("domain", domain);
  if (cmaErr) throw new Error(cmaErr.message);

  const mitigationAgg: Record<
    string,
    { suggested: number; applied: number; dismissed: number }
  > = {};
  const appliedByChangeSignal = new Set<string>();
  for (const a of cmas ?? []) {
    const s = (a as { signal_key?: string }).signal_key;
    const cid = (a as { change_event_id?: string }).change_event_id;
    if (!s) continue;
    mitigationAgg[s] = mitigationAgg[s] || {
      suggested: 0,
      applied: 0,
      dismissed: 0,
    };
    mitigationAgg[s].suggested += 1;
    const st = String((a as { status?: string }).status ?? "").toUpperCase();
    if (st === "APPLIED") {
      mitigationAgg[s].applied += 1;
      if (cid) appliedByChangeSignal.add(`${cid}:${s}`);
    }
    if (st === "DISMISSED")
      mitigationAgg[s].dismissed += 1;
  }

  const mitigGroups: Record<
    string,
    { appliedTotal: number; appliedInc: number; controlTotal: number; controlInc: number }
  > = {};

  const { data: signals, error: sigErr } = await supabaseAdmin
    .from("risk_signals")
    .select("change_event_id, signal_key")
    .in("change_event_id", changeIds)
    .eq("domain", domain);

  if (sigErr) throw new Error(sigErr.message);

  const changeByRev = new Map<string, number>();
  const changeBySubmitted = new Map<string, string | null>();
  const changeById = new Map<string, Record<string, unknown>>();
  for (const c of changes ?? []) {
    const id = String((c as { id: string }).id);
    changeByRev.set(id, Number((c as { revenue_at_risk?: number }).revenue_at_risk ?? 0));
    changeBySubmitted.set(id, (c as { submitted_at?: string | null }).submitted_at ?? null);
    changeById.set(id, c as Record<string, unknown>);
  }

  type BucketAgg = {
    total: number;
    incidents: number;
    decayedTotal: number;
    decayedInc: number;
    appliedTotal: number;
    appliedInc: number;
    controlTotal: number;
    controlInc: number;
  };
  const bucketAgg: Record<string, BucketAgg> = {};
  const keyOf = (d: string, s: string, b: string) => `${d}:${s}:${b}`;

  const agg: Record<
    string,
    {
      totalW: number;
      incidentW: number;
      totalRARW: number;
      incidentRARW: number;
      realizedMrrW: number;
      realizedRevW: number;
      totalChanges: number;
      incidentChanges: number;
      totalRAR: number;
      incidentRAR: number;
    }
  > = {};

  for (const s of signals ?? []) {
    const changeId = String((s as { change_event_id: string }).change_event_id);
    const signalKey = String((s as { signal_key: string }).signal_key);
    const rar = changeByRev.get(changeId) ?? 0;
    const submittedAt = changeBySubmitted.get(changeId) ?? null;
    const w = decayWeight(submittedAt, halfLifeDays);

    const incident = incidentByChange.get(changeId);
    const isIncident = !!incident;

    if (!agg[signalKey]) {
      agg[signalKey] = {
        totalW: 0,
        incidentW: 0,
        totalRARW: 0,
        incidentRARW: 0,
        realizedMrrW: 0,
        realizedRevW: 0,
        totalChanges: 0,
        incidentChanges: 0,
        totalRAR: 0,
        incidentRAR: 0,
      };
    }

    agg[signalKey].totalW += w;
    agg[signalKey].totalRARW += rar * w;
    agg[signalKey].totalChanges += 1;
    agg[signalKey].totalRAR += rar;

    if (isIncident) {
      agg[signalKey].incidentW += w;
      agg[signalKey].incidentRARW += rar * w;
      agg[signalKey].incidentChanges += 1;
      agg[signalKey].incidentRAR += rar;
      agg[signalKey].realizedMrrW += (incident.realizedMrr || 0) * w;
      agg[signalKey].realizedRevW += (incident.realizedRev || 0) * w;
    }

    mitigGroups[signalKey] = mitigGroups[signalKey] ?? {
      appliedTotal: 0,
      appliedInc: 0,
      controlTotal: 0,
      controlInc: 0,
    };
    const applied = appliedByChangeSignal.has(`${changeId}:${signalKey}`);
    if (applied) {
      mitigGroups[signalKey].appliedTotal += 1;
      if (isIncident) mitigGroups[signalKey].appliedInc += 1;
    } else {
      mitigGroups[signalKey].controlTotal += 1;
      if (isIncident) mitigGroups[signalKey].controlInc += 1;
    }

    const changeObj = changeById.get(changeId);
    const bucket = changeObj
      ? exposureBucketFromChange({
          estimated_mrr_affected: changeObj.estimated_mrr_affected as number | null | undefined,
          percent_customer_base_affected: changeObj.percent_customer_base_affected as number | null | undefined,
        })
      : "NONE";
    const k = keyOf(domain, signalKey, bucket);
    bucketAgg[k] = bucketAgg[k] ?? {
      total: 0,
      incidents: 0,
      decayedTotal: 0,
      decayedInc: 0,
      appliedTotal: 0,
      appliedInc: 0,
      controlTotal: 0,
      controlInc: 0,
    };
    const b = bucketAgg[k];
    b.total += 1;
    b.decayedTotal += w;
    if (isIncident) {
      b.incidents += 1;
      b.decayedInc += w;
    }
    if (applied) {
      b.appliedTotal += 1;
      if (isIncident) b.appliedInc += 1;
    } else {
      b.controlTotal += 1;
      if (isIncident) b.controlInc += 1;
    }
  }

  for (const [signalKey, a] of Object.entries(agg)) {
    const incidentRate = safeDiv(a.incidentChanges, a.totalChanges);
    const revenueIncidentRate = safeDiv(a.incidentRAR, a.totalRAR);

    const m = mitigationAgg[signalKey] || {
      suggested: 0,
      applied: 0,
      dismissed: 0,
    };
    const effectiveness =
      m.applied <= 0
        ? 0
        : clamp(
            1 - safeDiv(a.incidentChanges, Math.max(1, a.totalChanges)),
            0,
            1
          );

    const learned = computeLearnedMultiplierV2({
      totalW: a.totalW,
      incidentW: a.incidentW,
      totalRARW: a.totalRARW,
      incidentRARW: a.incidentRARW,
      realizedMrrW: a.realizedMrrW,
      mitigationEffectiveness: effectiveness,
    });

    const bayes = betaPosteriorFromCounts({
      total: a.totalChanges,
      incidents: a.incidentChanges,
      priorAlpha: 1,
      priorBeta: 19,
      credibleMass: 0.9,
    });

    const mg = mitigGroups[signalKey] ?? {
      appliedTotal: 0,
      appliedInc: 0,
      controlTotal: 0,
      controlInc: 0,
    };
    const lift = mitigationLiftBayes({
      appliedTotal: mg.appliedTotal,
      appliedIncidents: mg.appliedInc,
      controlTotal: mg.controlTotal,
      controlIncidents: mg.controlInc,
      priorAlpha: 1,
      priorBeta: 19,
      credibleMass: 0.9,
    });

    await supabaseAdmin.from("signal_stats").upsert(
      {
        org_id: orgId,
        domain,
        signal_key: signalKey,
        model_version: modelVersion,
        total_changes: a.totalChanges,
        incident_changes: a.incidentChanges,
        total_revenue_at_risk: a.totalRAR,
        incident_revenue_at_risk: a.incidentRAR,
        incident_rate: incidentRate,
        revenue_incident_rate: revenueIncidentRate,
        incident_realized_mrr: a.realizedMrrW,
        incident_realized_revenue: a.realizedRevW,
        mitigations_total_suggested: m.suggested,
        mitigations_applied_count: m.applied,
        mitigations_dismissed_count: m.dismissed,
        mitigation_effectiveness: effectiveness,
        learned_multiplier: learned.learnedMultiplier,
        learned_multiplier_reason: learned.reason,
        bayes_alpha: bayes.alpha,
        bayes_beta: bayes.beta,
        bayes_mean: bayes.mean,
        bayes_ci_low: bayes.ciLow,
        bayes_ci_high: bayes.ciHigh,
        bayes_confidence: bayes.confidence,
        mitigation_lift: lift.liftMean,
        mitigation_ci_low: lift.liftLow,
        mitigation_ci_high: lift.liftHigh,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,domain,signal_key,model_version" }
    );
  }

  const MIN_N_FOR_LIFT = 20;
  const bucketRows: Record<string, unknown>[] = [];
  for (const k of Object.keys(bucketAgg)) {
    const parts = k.split(":");
    const domainPart = parts[0];
    const signalKeyPart = parts[1];
    const exposureBucket = parts[2];
    const a = bucketAgg[k];

    const bayesRaw = betaPosteriorFromCounts({
      total: a.total,
      incidents: a.incidents,
      priorAlpha: 1,
      priorBeta: 19,
      credibleMass: 0.9,
    });

    const bayesDecayed = betaPosteriorFromEffectiveCounts({
      effTotal: a.decayedTotal,
      effIncidents: a.decayedInc,
      priorAlpha: 1,
      priorBeta: 19,
    });

    const showLift = a.appliedTotal + a.controlTotal >= MIN_N_FOR_LIFT;
    const lift = showLift
      ? mitigationLiftBayes({
          appliedTotal: a.appliedTotal,
          appliedIncidents: a.appliedInc,
          controlTotal: a.controlTotal,
          controlIncidents: a.controlInc,
          priorAlpha: 1,
          priorBeta: 19,
          credibleMass: 0.9,
        })
      : { liftMean: 0, liftLow: 0, liftHigh: 0 };

    bucketRows.push({
      org_id: orgId,
      domain: domainPart,
      signal_key: signalKeyPart,
      exposure_bucket: exposureBucket,
      total_changes: a.total,
      incident_changes: a.incidents,
      decayed_total: a.decayedTotal,
      decayed_incidents: a.decayedInc,
      bayes_alpha: bayesRaw.alpha,
      bayes_beta: bayesRaw.beta,
      bayes_mean: bayesRaw.mean,
      bayes_ci_low: bayesRaw.ciLow,
      bayes_ci_high: bayesRaw.ciHigh,
      bayes_d_alpha: bayesDecayed.alpha,
      bayes_d_beta: bayesDecayed.beta,
      bayes_d_mean: bayesDecayed.mean,
      bayes_d_ci_low: bayesDecayed.ciLow,
      bayes_d_ci_high: bayesDecayed.ciHigh,
      bayes_d_confidence: bayesDecayed.confidence,
      mitigation_lift: lift.liftMean,
      mitigation_ci_low: lift.liftLow,
      mitigation_ci_high: lift.liftHigh,
      updated_at: new Date().toISOString(),
    });
  }

  if (bucketRows.length > 0) {
    await supabaseAdmin
      .from("signal_stats_buckets")
      .upsert(bucketRows, {
        onConflict: "org_id,domain,signal_key,exposure_bucket",
      });
  }

  return {
    signals: Object.keys(agg).length,
    windowDays,
    halfLifeDays,
  };
}
