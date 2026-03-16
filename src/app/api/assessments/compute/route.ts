import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { WEIGHTS, bucketFromScore } from "@/services/risk/weights";
import { applyRevenueExposure } from "@/services/risk/exposure";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";
import { getLearnedMultiplierForSignals } from "@/services/risk/learnedMultiplier";
import { recomputeAndPersistRevenueFields } from "@/services/risk/revenuePersist";
import { auditLog } from "@/lib/audit";

type ReqBody = { changeEventId: string };

type MitigationRow = {
  signalKey: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string;
  metadata?: Record<string, unknown>;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function exposureBucketFromScore(
  exposureScore: number,
  opts: { hasExposureContext: boolean }
): "NONE" | "LOW" | "MED" | "HIGH" | "EXTREME" {
  if (!opts.hasExposureContext) return "NONE";
  if (exposureScore < 8) return "LOW";
  if (exposureScore < 16) return "MED";
  if (exposureScore < 26) return "HIGH";
  return "EXTREME";
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  const supabase = await createServerSupabaseClient();
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal =
    !!env.cronSecret &&
    internalSecret === env.cronSecret;

  if (!isInternal) {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.changeEventId) {
    return NextResponse.json({ error: "Missing changeEventId" }, { status: 400 });
  }

  const db = isInternal ? admin : supabase;

  // Pull change context (includes Phase 1A exposure fields)
  const { data: change, error: ceErr } = await db
    .from("change_events")
    .select(
      "id, org_id, domain, created_by, revenue_surface, estimated_mrr_affected, percent_customer_base_affected, customers_affected_count"
    )
    .eq("id", body.changeEventId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  if (!isInternal) {
    const { data: userRes } = await supabase.auth.getUser();
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", change.org_id)
      .eq("user_id", userRes?.user?.id ?? "")
      .maybeSingle();

    if (!member)
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
  }

  const { data: signals, error: sigErr } = await db
    .from("risk_signals")
    .select(
      "id, signal_key, value_type, value_bool, value_num, confidence, category, domain, source"
    )
    .eq("change_event_id", body.changeEventId);

  if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 });

  const { data: baselineRow } = await db
    .from("risk_learning_baseline")
    .select("baseline_incident_rate_smoothed, min_samples")
    .eq("id", 1)
    .maybeSingle();

  const baselineRate = Number(baselineRow?.baseline_incident_rate_smoothed ?? 0);
  const minSamples = Number(baselineRow?.min_samples ?? 20);

  const keys = Array.from(new Set((signals ?? []).map((s) => s.signal_key))).filter(Boolean);

  const changeDomain = String(change.domain ?? "REVENUE");
  const learnedFromStats = await getLearnedMultiplierForSignals(db, {
    orgId: String(change.org_id),
    domain: changeDomain,
    signalKeys: keys,
  });

  const { data: statsRows } = await db
    .from("signal_statistics")
    .select("signal_key, incident_rate_smoothed, total_changes")
    .in("signal_key", keys);

  const statsMap = new Map<string, { incidentRate: number; total: number }>();
  for (const r of statsRows ?? []) {
    const row = r as {
      signal_key: string;
      incident_rate_smoothed?: number;
      total_changes?: number;
    };
    statsMap.set(row.signal_key, {
      incidentRate: Number(row.incident_rate_smoothed ?? 0),
      total: Number(row.total_changes ?? 0),
    });
  }

  // Prefer DB-configured signal weights; fall back to WEIGHTS
  const defMap = new Map<string, number>();
  try {
    const { data: defRows, error: defErr } = await db
      .from("signal_definitions")
      .select("signal_key, base_weight, enabled, domain")
      .in("signal_key", keys)
      .eq("enabled", true)
      .or(`domain.eq.${change.domain ?? "REVENUE"},domain.is.null`);
    if (!defErr && defRows) {
      for (const r of defRows) {
        defMap.set(
          String((r as { signal_key?: string }).signal_key),
          Number((r as { base_weight?: number }).base_weight ?? 0)
        );
      }
    }
  } catch {
    // signal_definitions may not exist on older installs
  }

  const getBaseWeight = (signalKey: string) =>
    defMap.get(signalKey) ?? WEIGHTS[signalKey] ?? 0;

  let baseScore = 0;

  const updates: Array<{
    id: string;
    signal_key: string;
    value_type: string;
    value_bool: boolean | null;
    value_num: number | null;
    weight_at_time: number;
    contribution: number;
  }> = [];

  for (const s of signals ?? []) {
    const baseWeight = getBaseWeight(String(s.signal_key ?? ""));
    const st = statsMap.get(String(s.signal_key ?? ""));
    const incidentRate = st ? st.incidentRate : 0;
    const totalChanges = st ? st.total : 0;

    const learnedMultiplier =
      totalChanges < minSamples
        ? 1
        : clamp(1 + (incidentRate - baselineRate), 0.5, 2.0);
    const effectiveWeight = baseWeight * learnedMultiplier;

    if (s.value_type === "BOOLEAN") {
      const isTrue = s.value_bool === true;
      const contrib = isTrue ? effectiveWeight : 0;
      baseScore += contrib;
      updates.push({
        id: s.id,
        signal_key: String(s.signal_key),
        value_type: String(s.value_type),
        value_bool: s.value_bool ?? null,
        value_num: s.value_num ?? null,
        weight_at_time: effectiveWeight,
        contribution: contrib,
      });
      continue;
    }

    if (s.signal_key === "number_of_systems_involved") {
      const n = Number(s.value_num ?? 0);
      const contrib = Math.max(0, n - 2) * baseWeight;
      baseScore += contrib;
      updates.push({
        id: s.id,
        signal_key: String(s.signal_key),
        value_type: String(s.value_type),
        value_bool: s.value_bool ?? null,
        value_num: Number(s.value_num ?? 0),
        weight_at_time: baseWeight,
        contribution: contrib,
      });
      continue;
    }

    if (s.signal_key === "rollback_time_estimate_hours") {
      const hours = Number(s.value_num ?? 0);
      const contrib = Math.floor(Math.max(0, hours) / 2) * baseWeight;
      baseScore += contrib;
      updates.push({
        id: s.id,
        signal_key: String(s.signal_key),
        value_type: String(s.value_type),
        value_bool: s.value_bool ?? null,
        value_num: Number(s.value_num ?? 0),
        weight_at_time: baseWeight,
        contribution: contrib,
      });
      continue;
    }

    updates.push({
      id: s.id,
      signal_key: String(s.signal_key),
      value_type: String(s.value_type),
      value_bool: s.value_bool ?? null,
      value_num: s.value_num ?? null,
      weight_at_time: effectiveWeight,
      contribution: 0,
    });
  }

  const { data: domainScoring } = await supabase
    .from("domain_scoring")
    .select("base_multiplier")
    .eq("domain", changeDomain)
    .eq("enabled", true)
    .maybeSingle();

  const domainMultiplier = Number(
    (domainScoring as { base_multiplier?: number } | null)?.base_multiplier ?? 1
  );
  const baseRiskScore = Math.round(baseScore * domainMultiplier);

  // Phase 1A exposure multiplier (buckets based on exposure-weighted score)
  const { riskScore, revenue } = applyRevenueExposure(baseRiskScore, {
    estimatedMrrAffected: change.estimated_mrr_affected ?? null,
    percentCustomerBaseAffected: change.percent_customer_base_affected ?? null,
    revenueSurface: change.revenue_surface ?? null,
  });

  const exposureMultiplier = revenue.exposureMultiplier;
  const learnedMultiplier = learnedFromStats.multiplier;
  const preLearnedScore = Math.round(riskScore);
  const afterLearned = clamp(
    preLearnedScore * learnedMultiplier,
    0,
    100
  );
  const exposureScore = Math.round(afterLearned);
  const riskBucket = bucketFromScore(exposureScore);
  const hasExposureContext =
    (change.estimated_mrr_affected ?? 0) > 0 ||
    (change.percent_customer_base_affected ?? 0) > 0 ||
    Boolean(change.revenue_surface);
  const exposureBucket = exposureBucketFromScore(exposureScore, {
    hasExposureContext,
  });

  for (const u of updates) {
    const { error } = await db
      .from("risk_signals")
      .update({ weight_at_time: u.weight_at_time, contribution: u.contribution })
      .eq("id", u.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: assessment, error: aSelErr } = await db
    .from("impact_assessments")
    .select("id")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aSelErr) return NextResponse.json({ error: aSelErr.message }, { status: 500 });
  if (!assessment?.id) {
    return NextResponse.json({ error: "No assessment found for change" }, { status: 400 });
  }

  const { error: aUpdErr } = await admin
    .from("impact_assessments")
    .update({
      domain: changeDomain,
      risk_score_raw: exposureScore,
      risk_bucket: riskBucket,
      status: "READY",
    })
    .eq("id", assessment.id);

  if (aUpdErr) return NextResponse.json({ error: aUpdErr.message }, { status: 500 });

  const topSignalDrivers = updates
    .filter((u) => u.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6)
    .map((u) => ({
      signal_key: u.signal_key,
      contribution: Number(u.contribution),
      value: u.value_type === "BOOLEAN" ? u.value_bool === true : u.value_num,
    }));

  const { error: outErr } = await admin.from("risk_assessment_outputs").insert({
    org_id: change.org_id,
    change_event_id: body.changeEventId,
    base_risk_score: baseRiskScore,
    exposure_score: exposureScore,
    risk_bucket: riskBucket,
    exposure_bucket: exposureBucket,
    revenue_surface_multiplier: revenue.exposureMultiplier,
    mrr_multiplier: (revenue.explanation as { mrrFactor?: number }).mrrFactor ?? 1,
    customer_multiplier: (revenue.explanation as { pctFactor?: number }).pctFactor ?? 1,
    top_signal_drivers: topSignalDrivers,
  });

  if (outErr) return NextResponse.json({ error: outErr.message }, { status: 500 });

  const actorId = isInternal
    ? String((change as { created_by?: string }).created_by ?? "")
    : (await supabase.auth.getUser()).data.user?.id ?? "";
  await auditLog(db, {
    orgId: String(change.org_id),
    changeEventId: body.changeEventId,
    actorId,
    actorType: "USER",
    action: "assessment_computed",
    entityType: "change_event",
    entityId: body.changeEventId,
    metadata: {
      baseRiskScore: baseRiskScore,
      exposureScore,
      riskBucket,
      exposureBucket,
      multipliers: {
        revenueSurface: (revenue.explanation as { surfaceWeight?: number }).surfaceWeight ?? 1,
        mrr: (revenue.explanation as { mrrFactor?: number }).mrrFactor ?? 1,
        customer: (revenue.explanation as { pctFactor?: number }).pctFactor ?? 1,
        domain: domainMultiplier,
      },
    },
  });

  try {
    await recomputeAndPersistRevenueFields(admin, {
      changeId: body.changeEventId,
    });
  } catch (e) {
    // Non-fatal: columns may not exist if migration 064 not applied
  }

  try {
    await admin
      .from("change_events")
      .update({
        risk_explanation: {
          baseRisk: baseRiskScore,
          learned: learnedFromStats.details,
          learnedMultiplier: learnedFromStats.multiplier,
          exposureMultiplier,
          preLearnedScore,
          finalRisk: exposureScore,
        },
      })
      .eq("id", body.changeEventId);
  } catch {
    // risk_explanation column may not exist if migration 068 not applied
  }

  let mitigations: MitigationRow[] = [];
  try {
    const dbMitigations = await fetchMitigationsForSignals(admin, {
      orgId: String(change.org_id),
      domain: changeDomain,
      signalKeys: keys,
    });
    const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    mitigations = dbMitigations
      .sort(
        (a, b) =>
          (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2)
      )
      .map((m) => ({
        signalKey: m.signalKey,
        severity: m.severity,
        recommendation: m.recommendation,
        metadata: m.metadata,
      }));
  } catch {
    // signal_mitigations may not exist yet
  }

  return NextResponse.json({
    ok: true,
    baseRiskScore,
    exposureScore,
    riskBucket,
    exposureBucket,
    revenue,
    multipliers: {
      revenueSurface: (revenue.explanation as { surfaceWeight?: number }).surfaceWeight ?? 1,
      mrr: (revenue.explanation as { mrrFactor?: number }).mrrFactor ?? 1,
      customer: (revenue.explanation as { pctFactor?: number }).pctFactor ?? 1,
      domain: domainMultiplier,
    },
    topSignalDrivers,
    mitigations,
    baselineRate,
  });
}
