import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import {
  calculateChangeReadiness,
  loadOrgReadinessWeights,
} from "@/lib/readiness/calculateChangeReadiness";
import { buildPredictionsForChange } from "@/lib/readiness/buildPredictionsForChange";
import { autoResolvePredictionsForChange } from "@/lib/readiness/resolvePredictions";
import { scoreToLevel, worsenedByBands, type ReadinessLevel } from "@/lib/readiness/types";
import { isPredictionType } from "@/lib/readiness/predictionTypes";
import { enqueueNotificationEvents } from "@/services/notifications/createNotifications";

const MS_14D = 14 * 86400000;

function inNext14Days(dueAt: string | null, now: number): boolean {
  if (!dueAt) return true;
  const t = new Date(dueAt).getTime();
  return t >= now - 86400000 && t <= now + MS_14D;
}

async function isSuppressed(
  admin: SupabaseClient,
  orgId: string,
  changeId: string,
  predictionType: string,
  rootCauseHash: string
): Promise<boolean> {
  const { data } = await admin
    .from("prediction_suppressions")
    .select("until")
    .eq("org_id", orgId)
    .eq("change_event_id", changeId)
    .eq("prediction_type", predictionType)
    .eq("root_cause_hash", rootCauseHash)
    .maybeSingle();
  if (!data) return false;
  return new Date((data as { until: string }).until).getTime() > Date.now();
}

/**
 * Phase 5: recompute readiness + predictions for one org (service role client).
 */
export async function recomputeOrganizationReadiness(
  admin: SupabaseClient,
  orgId: string
): Promise<{ changesProcessed: number }> {
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const { data: settings } = await admin
    .from("organization_settings")
    .select(
      "predictive_warnings_enabled, prediction_min_confidence, prediction_enabled_types, readiness_dimension_weights, prediction_expire_days, readiness_prior_band_json"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  const s = settings as {
    predictive_warnings_enabled?: boolean;
    prediction_min_confidence?: number;
    prediction_enabled_types?: string[] | null;
    readiness_dimension_weights?: unknown;
    prediction_expire_days?: number;
    readiness_prior_band_json?: { portfolioLevel?: ReadinessLevel; portfolioScore?: number; notReadyReleases?: number } | null;
  } | null;

  const minConf = s?.prediction_min_confidence ?? 75;
  const expireDays = s?.prediction_expire_days ?? 14;
  const enabledTypes = new Set(s?.prediction_enabled_types ?? []);
  const predictiveOn = Boolean(s?.predictive_warnings_enabled);

  await admin
    .from("predicted_risk_events")
    .update({ status: "EXPIRED", resolved_at: nowIso })
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .lt("expires_at", nowIso);

  const changeIdSet = new Set<string>();

  const { data: queued } = await admin
    .from("readiness_recompute_queue")
    .select("change_event_id")
    .eq("org_id", orgId);
  for (const q of queued ?? []) {
    changeIdSet.add((q as { change_event_id: string }).change_event_id);
  }

  const { data: ceRows } = await scopeActiveChangeEvents(
    admin.from("change_events").select("id, due_at, status, revenue_at_risk")
  )
    .eq("org_id", orgId);

  for (const row of ceRows ?? []) {
    const st = String((row as { status?: string }).status ?? "").toUpperCase();
    if (st === "DRAFT" || st === "CANCELLED") continue;
    const dueAt = (row as { due_at?: string | null }).due_at ?? null;
    if (inNext14Days(dueAt, now)) {
      changeIdSet.add((row as { id: string }).id);
    }
  }

  const weightsJson = s?.readiness_dimension_weights;
  const weights = await loadOrgReadinessWeights(admin, orgId);

  const priorPortfolio = s?.readiness_prior_band_json ?? null;
  const prevPortfolioLevel = (priorPortfolio?.portfolioLevel as ReadinessLevel | undefined) ?? null;

  for (const changeId of changeIdSet) {
    const readiness = await calculateChangeReadiness(admin, { changeId, weightsJson });
    if (!readiness) continue;

    const { data: oldSnap } = await admin
      .from("readiness_snapshots")
      .select("readiness_score")
      .eq("org_id", orgId)
      .eq("scope_type", "CHANGE")
      .eq("scope_id", changeId)
      .gte("captured_at", new Date(now - 7 * 86400000).toISOString())
      .order("captured_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const priorScore =
      oldSnap && typeof (oldSnap as { readiness_score?: number }).readiness_score === "number"
        ? Number((oldSnap as { readiness_score: number }).readiness_score)
        : null;

    await autoResolvePredictionsForChange(admin, {
      orgId,
      changeId,
      readiness,
      priorReadinessScore: priorScore,
    });

    await admin.from("readiness_scores").upsert(
      {
        org_id: orgId,
        scope_type: "CHANGE",
        scope_id: changeId,
        readiness_score: readiness.score,
        readiness_level: readiness.level,
        explanation_json: { dimensions: readiness.dimensions, weights },
        calculated_at: nowIso,
      },
      { onConflict: "org_id,scope_type,scope_id" }
    );

    if (!predictiveOn) continue;

    const built = await buildPredictionsForChange(admin, {
      orgId,
      changeId,
      readiness,
      expireDays,
    });

    const expiresAt = new Date(now + expireDays * 86400000).toISOString();

    for (const p of built) {
      if (!isPredictionType(p.prediction_type)) continue;
      if (enabledTypes.size > 0 && !enabledTypes.has(p.prediction_type)) continue;
      if (p.confidence_score < minConf) continue;
      if (await isSuppressed(admin, orgId, changeId, p.prediction_type, p.root_cause_hash)) continue;

      const { data: existing } = await admin
        .from("predicted_risk_events")
        .select("id, confidence_score, prediction_type, readiness_level_snapshot")
        .eq("org_id", orgId)
        .eq("change_event_id", changeId)
        .eq("prediction_type", p.prediction_type)
        .eq("root_cause_hash", p.root_cause_hash)
        .eq("status", "ACTIVE")
        .maybeSingle();

      let materiallyNew = !existing;
      if (existing) {
        const prevC = Number((existing as { confidence_score?: number }).confidence_score ?? 0);
        if (p.confidence_score >= prevC + 10) materiallyNew = true;
        const prevL = (existing as { readiness_level_snapshot?: string | null }).readiness_level_snapshot as
          | ReadinessLevel
          | undefined;
        if (prevL && worsenedByBands(prevL, readiness.level)) materiallyNew = true;
      }

      if (existing) {
        await admin
          .from("predicted_risk_events")
          .update({
            confidence_score: Math.max(
              Number((existing as { confidence_score?: number }).confidence_score ?? 0),
              p.confidence_score
            ),
            explanation_json: p.explanation_json as unknown as Record<string, unknown>,
            expires_at: expiresAt,
            readiness_level_snapshot: readiness.level,
          })
          .eq("id", (existing as { id: string }).id);
        if (!materiallyNew) continue;
      } else {
        const { error: insErr } = await admin.from("predicted_risk_events").insert({
          org_id: orgId,
          change_event_id: changeId,
          prediction_type: p.prediction_type,
          root_cause_hash: p.root_cause_hash,
          confidence_score: p.confidence_score,
          predicted_impact: p.predicted_impact,
          explanation_json: p.explanation_json as unknown as Record<string, unknown>,
          status: "ACTIVE",
          expires_at: expiresAt,
          readiness_level_snapshot: readiness.level,
        });
        if (insErr) {
          if (!String(insErr.message).includes("duplicate")) {
             
            console.warn("predicted_risk_events insert:", insErr.message);
          }
          continue;
        }
      }

      if (!materiallyNew) continue;

      await enqueueNotificationEvents(admin, {
        orgId,
        changeEventId: changeId,
        templateKey: "predicted_risk_early_warning",
        payload: {
          headline: p.explanation_json.headline,
          predictionType: p.prediction_type,
          confidence: p.confidence_score,
        },
        dedupeKeyBase: `pred_warn:${changeId}:${p.prediction_type}:${p.root_cause_hash}:${nowIso.slice(0, 16)}`,
        channels: ["IN_APP", "SLACK"],
      });
    }
  }

  const { data: releases } = await admin
    .from("releases")
    .select("id, target_release_at, status")
    .eq("org_id", orgId)
    .not("status", "eq", "CANCELLED");

  let notReadyReleaseCount = 0;
  for (const rel of releases ?? []) {
    const rid = (rel as { id: string }).id;
    const { data: rcs } = await admin
      .from("release_changes")
      .select("change_event_id")
      .eq("release_id", rid);
    const ids = (rcs ?? []).map((x) => (x as { change_event_id: string }).change_event_id);
    if (ids.length === 0) continue;
    const scores: number[] = [];
    for (const cid of ids) {
      const { data: rs } = await admin
        .from("readiness_scores")
        .select("readiness_score")
        .eq("org_id", orgId)
        .eq("scope_type", "CHANGE")
        .eq("scope_id", cid)
        .maybeSingle();
      if (rs && typeof (rs as { readiness_score?: number }).readiness_score === "number") {
        scores.push(Number((rs as { readiness_score: number }).readiness_score));
      }
    }
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const low = Math.min(...scores);
    const relScore = Math.round(0.7 * avg + 0.3 * low);
    const relLevel = scoreToLevel(relScore);
    if (relLevel === "NOT_READY") notReadyReleaseCount += 1;

    await admin.from("readiness_scores").upsert(
      {
        org_id: orgId,
        scope_type: "RELEASE",
        scope_id: rid,
        readiness_score: relScore,
        readiness_level: relLevel,
        explanation_json: { childCount: scores.length, avg, low },
        calculated_at: nowIso,
      },
      { onConflict: "org_id,scope_type,scope_id" }
    );
  }

  const portfolioItems: { score: number; weight: number }[] = [];
  for (const row of ceRows ?? []) {
    const id = (row as { id: string }).id;
    const { data: rc } = await admin
      .from("release_changes")
      .select("id")
      .eq("change_event_id", id)
      .maybeSingle();
    if (rc) continue;
    if (!inNext14Days((row as { due_at?: string | null }).due_at ?? null, now)) continue;
    const st = String((row as { status?: string }).status ?? "").toUpperCase();
    if (st === "DRAFT" || st === "CANCELLED") continue;
    const { data: crs } = await admin
      .from("readiness_scores")
      .select("readiness_score")
      .eq("org_id", orgId)
      .eq("scope_type", "CHANGE")
      .eq("scope_id", id)
      .maybeSingle();
    const sc = crs ? Number((crs as { readiness_score?: number }).readiness_score ?? 0) : 50;
    const rev = Number((row as { revenue_at_risk?: number | null }).revenue_at_risk ?? 0);
    portfolioItems.push({ score: sc, weight: rev > 0 ? rev : 1 });
  }

  for (const rel of releases ?? []) {
    const tr = (rel as { target_release_at?: string | null }).target_release_at;
    if (tr) {
      const t = new Date(tr).getTime();
      if (t < now || t > now + MS_14D) continue;
    }
    const rid = (rel as { id: string }).id;
    const { data: prs } = await admin
      .from("readiness_scores")
      .select("readiness_score")
      .eq("org_id", orgId)
      .eq("scope_type", "RELEASE")
      .eq("scope_id", rid)
      .maybeSingle();
    if (prs && typeof (prs as { readiness_score?: number }).readiness_score === "number") {
      portfolioItems.push({
        score: Number((prs as { readiness_score: number }).readiness_score),
        weight: 1,
      });
    }
  }

  let portScore = 0;
  if (portfolioItems.length > 0) {
    const tw = portfolioItems.reduce((a, b) => a + b.weight, 0);
    portScore = Math.round(
      portfolioItems.reduce((a, b) => a + b.score * b.weight, 0) / Math.max(1, tw)
    );
  } else {
    portScore = 100;
  }
  const portLevel = scoreToLevel(portScore);

  await admin.from("readiness_scores").upsert(
    {
      org_id: orgId,
      scope_type: "PORTFOLIO",
      scope_id: orgId,
      readiness_score: portScore,
      readiness_level: portLevel,
      explanation_json: { itemCount: portfolioItems.length },
      calculated_at: nowIso,
    },
    { onConflict: "org_id,scope_type,scope_id" }
  );

  if (predictiveOn && prevPortfolioLevel && worsenedByBands(prevPortfolioLevel, portLevel)) {
    const anyChange = changeIdSet.values().next().value as string | undefined;
    if (anyChange) {
      await enqueueNotificationEvents(admin, {
        orgId,
        changeEventId: anyChange,
        templateKey: "readiness_band_cross",
        payload: {
          headline: `Portfolio readiness crossed to ${portLevel}`,
          from: prevPortfolioLevel,
          to: portLevel,
        },
        dedupeKeyBase: `readiness_band:${orgId}:${portLevel}:${new Date().toISOString().slice(0, 13)}`,
        channels: ["IN_APP"],
      });
    }
  }

  const weekAgoIso = new Date(now - 7 * 86400000).toISOString();
  const { data: portSnap7d } = await admin
    .from("readiness_snapshots")
    .select("readiness_score")
    .eq("org_id", orgId)
    .eq("scope_type", "PORTFOLIO")
    .eq("scope_id", orgId)
    .lte("captured_at", weekAgoIso)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const scoreWeekAgo =
    portSnap7d && typeof (portSnap7d as { readiness_score?: number }).readiness_score === "number"
      ? Number((portSnap7d as { readiness_score: number }).readiness_score)
      : null;
  const scoreDrop10 = scoreWeekAgo != null && portScore <= scoreWeekAgo - 10;

  const prevNotReadyRel = priorPortfolio?.notReadyReleases ?? 0;
  const notReadyJump2 = notReadyReleaseCount >= prevNotReadyRel + 2;
  if (predictiveOn && (scoreDrop10 || notReadyJump2)) {
    const anchorChange = changeIdSet.values().next().value as string | undefined;
    if (anchorChange) {
      await enqueueNotificationEvents(admin, {
        orgId,
        changeEventId: anchorChange,
        templateKey: "portfolio_deterioration",
        payload: {
          scoreDrop: scoreDrop10,
          notReadyJump: notReadyJump2,
          fromScore: scoreWeekAgo,
          toScore: portScore,
          prevNotReadyReleases: prevNotReadyRel,
          notReadyReleases: notReadyReleaseCount,
        },
        dedupeKeyBase: `portfolio_deterior:${orgId}:${new Date().toISOString().slice(0, 13)}`,
        channels: ["IN_APP", "SLACK"],
      });
    }
  }

  await admin
    .from("organization_settings")
    .update({
      readiness_prior_band_json: {
        portfolioLevel: portLevel,
        portfolioScore: portScore,
        notReadyReleases: notReadyReleaseCount,
      } as unknown as Record<string, unknown>,
    })
    .eq("org_id", orgId);

  if (queued?.length) {
    const qids = (queued as { change_event_id: string }[]).map((q) => q.change_event_id);
    await admin.from("readiness_recompute_queue").delete().in("change_event_id", qids);
  }

  return { changesProcessed: changeIdSet.size };
}
