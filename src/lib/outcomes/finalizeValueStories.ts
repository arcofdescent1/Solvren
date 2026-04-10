import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfidenceLevel, EvidenceJsonV1, OutcomeType } from "@/lib/outcomes/types";
import { DEFAULT_OBSERVATION_DAYS, isOutcomeType } from "@/lib/outcomes/types";
import { hasDownstreamIncident } from "@/lib/outcomes/downstreamIncident";
import { computeRevenueProtected } from "@/lib/outcomes/revenueProtected";
import { getRevenueAtRiskBasis } from "@/lib/outcomes/getRevenueAtRiskBasis";
function observationDaysForOrg(
  outcomeType: OutcomeType,
  overrides: Record<string, number> | null
): number {
  if (overrides && typeof overrides[outcomeType] === "number") {
    return Math.max(1, Math.min(90, overrides[outcomeType]!));
  }
  return DEFAULT_OBSERVATION_DAYS[outcomeType];
}

async function releaseCancelledForChange(
  admin: SupabaseClient,
  changeEventId: string
): Promise<boolean> {
  const { data: rc } = await admin
    .from("release_changes")
    .select("release_id")
    .eq("change_event_id", changeEventId)
    .maybeSingle();
  if (!rc) return false;
  const rid = (rc as { release_id: string }).release_id;
  const { data: rel } = await admin.from("releases").select("status").eq("id", rid).maybeSingle();
  return String((rel as { status?: string } | null)?.status ?? "").toUpperCase() === "CANCELLED";
}

async function readinessImprovementPoints(args: {
  admin: SupabaseClient;
  changeEventId: string;
  predictionCreatedAt: string;
}): Promise<number | null> {
  const { admin, changeEventId, predictionCreatedAt } = args;
  const { data: first } = await admin
    .from("readiness_snapshots")
    .select("readiness_score, captured_at")
    .eq("scope_type", "CHANGE")
    .eq("scope_id", changeEventId)
    .gt("captured_at", predictionCreatedAt)
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: last } = await admin
    .from("readiness_snapshots")
    .select("readiness_score, captured_at")
    .eq("scope_type", "CHANGE")
    .eq("scope_id", changeEventId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const a = first && typeof (first as { readiness_score?: number }).readiness_score === "number"
    ? Number((first as { readiness_score: number }).readiness_score)
    : null;
  const b = last && typeof (last as { readiness_score?: number }).readiness_score === "number"
    ? Number((last as { readiness_score: number }).readiness_score)
    : null;
  if (a == null || b == null) return null;
  return b - a;
}

async function hasApprovalMateriallyReopened(
  admin: SupabaseClient,
  changeEventId: string,
  afterFinalApprovalIso: string
): Promise<boolean> {
  const { data: ce } = await admin.from("change_events").select("status").eq("id", changeEventId).maybeSingle();
  const st = String((ce as { status?: string } | null)?.status ?? "").toUpperCase();
  if (st !== "APPROVED") return true;

  const { data: evs } = await admin
    .from("change_timeline_events")
    .select("event_type")
    .eq("change_event_id", changeEventId)
    .gt("created_at", afterFinalApprovalIso);
  for (const e of evs ?? []) {
    const u = String((e as { event_type?: string }).event_type ?? "").toUpperCase();
    if (u.includes("REOPEN")) return true;
    if (u.includes("APPROVAL_REJECTED")) return true;
    if (u.includes("CHANGE_REJECTED")) return true;
  }

  const { data: pending } = await admin
    .from("approvals")
    .select("id")
    .eq("change_event_id", changeEventId)
    .eq("decision", "PENDING")
    .limit(1);
  if ((pending ?? []).length > 0) return true;

  return false;
}

/**
 * Finalize PENDING value stories whose observation window ended.
 */
export async function finalizeValueStoriesForOrg(
  admin: SupabaseClient,
  orgId: string
): Promise<{ finalized: number; rejected: number }> {
  let finalized = 0;
  let rejected = 0;
  const now = new Date().toISOString();

  const { data: settings } = await admin
    .from("organization_settings")
    .select("value_tracking_enabled, outcome_observation_overrides_json")
    .eq("org_id", orgId)
    .maybeSingle();
  const s = settings as {
    value_tracking_enabled?: boolean;
    outcome_observation_overrides_json?: Record<string, number> | null;
  } | null;
  if (s?.value_tracking_enabled === false) {
    return { finalized: 0, rejected: 0 };
  }

  const overrides = s?.outcome_observation_overrides_json ?? null;

  const { data: pending } = await admin
    .from("value_stories")
    .select(
      "id, change_event_id, prediction_id, outcome_type, evidence_json, confidence_level, corrective_action_at, status, estimated_value"
    )
    .eq("org_id", orgId)
    .eq("status", "PENDING");

  for (const row of pending ?? []) {
    const r = row as {
      id: string;
      change_event_id: string;
      prediction_id: string | null;
      outcome_type: string;
      evidence_json: EvidenceJsonV1 | Record<string, unknown>;
      confidence_level: ConfidenceLevel;
      corrective_action_at: string | null;
      estimated_value?: number;
    };
    if (!isOutcomeType(r.outcome_type)) continue;
    const ot = r.outcome_type;

    const ev = r.evidence_json as EvidenceJsonV1;
    const endsAt = ev?.observationWindow?.endsAt;
    if (!endsAt || new Date(endsAt).getTime() > new Date(now).getTime()) continue;

    if (await releaseCancelledForChange(admin, r.change_event_id)) {
      await admin
        .from("value_stories")
        .update({ status: "REJECTED", finalized_at: now })
        .eq("id", r.id);
      rejected += 1;
      continue;
    }

    const actionAt = r.corrective_action_at ?? ev?.observationWindow?.startedAt ?? now;

    const incident = await hasDownstreamIncident({
      admin,
      changeEventId: r.change_event_id,
      afterActionAt: actionAt,
      windowEnd: endsAt,
    });
    if (incident) {
      await admin
        .from("value_stories")
        .update({ status: "REJECTED", finalized_at: now })
        .eq("id", r.id);
      rejected += 1;
      continue;
    }

    let confidence: ConfidenceLevel = "HIGH_CONFIDENCE";
    if (r.confidence_level === "VERIFIED") {
      confidence = "VERIFIED";
    }

    const basis = await getRevenueAtRiskBasis(admin, r.change_event_id);

    let estimated: number | null = 0;
    if (ot === "READINESS_IMPROVED" && r.prediction_id) {
      const { data: predRow } = await admin
        .from("predicted_risk_events")
        .select("created_at")
        .eq("id", r.prediction_id)
        .maybeSingle();
      const predAt = (predRow as { created_at?: string } | null)?.created_at ?? actionAt;
      const delta = await readinessImprovementPoints({
        admin,
        changeEventId: r.change_event_id,
        predictionCreatedAt: predAt,
      });
      if (delta == null || delta < 5) {
        await admin
          .from("value_stories")
          .update({ status: "REJECTED", finalized_at: now })
          .eq("id", r.id);
        rejected += 1;
        continue;
      }
      estimated = delta;
    } else if (ot === "APPROVAL_TIME_SAVED") {
      const finalAt = r.corrective_action_at ?? ev?.observationWindow?.startedAt ?? actionAt;
      if (await hasApprovalMateriallyReopened(admin, r.change_event_id, finalAt)) {
        await admin
          .from("value_stories")
          .update({ status: "REJECTED", finalized_at: now })
          .eq("id", r.id);
        rejected += 1;
        continue;
      }
      const hs = ev?.hoursSaved;
      if (hs == null || !Number.isFinite(Number(hs)) || Number(hs) < 24) {
        await admin
          .from("value_stories")
          .update({ status: "REJECTED", finalized_at: now })
          .eq("id", r.id);
        rejected += 1;
        continue;
      }
      estimated = Number(hs);
    } else {
      estimated = computeRevenueProtected({
        estimatedMrrAffected: basis.monthlyValue ?? 0,
        impactDurationMonths: basis.assumedMonths,
        confidenceLevel: confidence,
        outcomeType: ot,
      });
    }

    await admin
      .from("value_stories")
      .update({
        status: "ACTIVE",
        confidence_level: confidence,
        estimated_value: estimated ?? 0,
        finalized_at: now,
      })
      .eq("id", r.id);
    finalized += 1;
  }

  return { finalized, rejected };
}

export function buildObservationWindow(args: {
  outcomeType: OutcomeType;
  correctiveActionAt: string;
  overrides: Record<string, number> | null;
}): { startedAt: string; endsAt: string; days: number } {
  const days = observationDaysForOrg(args.outcomeType, args.overrides);
  const start = new Date(args.correctiveActionAt).getTime();
  const ends = start + days * 86400000;
  return {
    startedAt: new Date(start).toISOString(),
    endsAt: new Date(ends).toISOString(),
    days,
  };
}
