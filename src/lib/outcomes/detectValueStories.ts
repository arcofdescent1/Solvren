import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceJsonV1, OutcomeType } from "@/lib/outcomes/types";
import { buildObservationWindow } from "@/lib/outcomes/finalizeValueStories";
import { resolveOutcomeTypeForResolvedPrediction } from "@/lib/outcomes/mapPredictionToOutcomeType";
import { computeRevenueProtected } from "@/lib/outcomes/revenueProtected";
import type { ConfidenceLevel } from "@/lib/outcomes/types";
import { getRevenueAtRiskBasis } from "@/lib/outcomes/getRevenueAtRiskBasis";
import { isMajorOutageCorrectiveTimelineEvent } from "@/lib/outcomes/createMajorOutageAvoidedStory";

const TIMELINE_ACTION_TYPES = new Set([
  "EVIDENCE_PROVIDED",
  "EVIDENCE_UPDATED",
  "APPROVAL_APPROVED",
  "APPROVAL_APPROVED_FROM_SLACK",
  "CHANGE_APPROVED",
  "COORDINATION_EVIDENCE_APPLIED",
  "COMMENT_ADDED",
]);

function headlineFor(outcome: OutcomeType, predType: string): string {
  return `Value: ${outcome.replace(/_/g, " ").toLowerCase()} (${predType.replace(/_/g, " ")})`;
}

/**
 * Create PENDING value stories from resolved predictions + post-prediction corrective signals.
 */
export async function detectValueStoriesForOrg(
  admin: SupabaseClient,
  orgId: string
): Promise<{ created: number }> {
  let created = 0;

  const { data: settings } = await admin
    .from("organization_settings")
    .select("value_tracking_enabled, outcome_observation_overrides_json")
    .eq("org_id", orgId)
    .maybeSingle();
  const s = settings as {
    value_tracking_enabled?: boolean;
    outcome_observation_overrides_json?: Record<string, number> | null;
  } | null;
  if (s?.value_tracking_enabled === false) return { created: 0 };

  const overrides = s?.outcome_observation_overrides_json ?? null;

  const { data: preds } = await admin
    .from("predicted_risk_events")
    .select("id, change_event_id, prediction_type, created_at, explanation_json")
    .eq("org_id", orgId)
    .in("status", ["RESOLVED", "EXPIRED"]);

  for (const p of preds ?? []) {
    const pr = p as {
      id: string;
      change_event_id: string;
      prediction_type: string;
      created_at: string;
      explanation_json?: { headline?: string };
    };
    const outcome = await resolveOutcomeTypeForResolvedPrediction(admin, {
      orgId,
      changeEventId: pr.change_event_id,
      predictionType: pr.prediction_type,
    });
    if (!outcome) continue;

    const { data: rc } = await admin
      .from("release_changes")
      .select("release_id")
      .eq("change_event_id", pr.change_event_id)
      .maybeSingle();
    if (rc) {
      const rid = (rc as { release_id: string }).release_id;
      const { data: rel } = await admin.from("releases").select("status").eq("id", rid).maybeSingle();
      if (String((rel as { status?: string } | null)?.status ?? "").toUpperCase() === "CANCELLED") {
        continue;
      }
    }

    const { data: events } = await admin
      .from("change_timeline_events")
      .select("event_type, created_at")
      .eq("change_event_id", pr.change_event_id)
      .gt("created_at", pr.created_at)
      .order("created_at", { ascending: true })
      .limit(20);

    const first = (events ?? []).find((e) => {
      const et = String((e as { event_type?: string }).event_type ?? "");
      if (outcome === "MAJOR_OUTAGE_AVOIDED") return isMajorOutageCorrectiveTimelineEvent(et);
      return TIMELINE_ACTION_TYPES.has(et);
    }) as { event_type: string; created_at: string } | undefined;
    if (!first?.created_at) continue;

    const correctiveAt = first.created_at;
    const win = buildObservationWindow({
      outcomeType: outcome,
      correctiveActionAt: correctiveAt,
      overrides,
    });

    const evidence: EvidenceJsonV1 = {
      schemaVersion: 1,
      predictionId: pr.id,
      changeEventId: pr.change_event_id,
      actions: [{ type: String(first.event_type), timestamp: first.created_at }],
      timelineEvents: [String(first.event_type)],
      observationWindow: { startedAt: win.startedAt, endsAt: win.endsAt },
    };

    const headline =
      pr.explanation_json?.headline && String(pr.explanation_json.headline).length > 0
        ? String(pr.explanation_json.headline)
        : headlineFor(outcome, pr.prediction_type);

    const storyText = `Solvren predicted ${pr.prediction_type.replace(/_/g, " ")}. The team acted (${first.event_type}). Observation through ${win.endsAt.slice(0, 10)}.`;

    const basis = await getRevenueAtRiskBasis(admin, pr.change_event_id);
    const initialConfidence: ConfidenceLevel = "LIKELY";
    const placeholderValue = computeRevenueProtected({
      estimatedMrrAffected: basis.monthlyValue ?? 0,
      impactDurationMonths: basis.assumedMonths,
      confidenceLevel: initialConfidence,
      outcomeType: outcome,
    });

    const { error } = await admin.from("value_stories").insert({
      org_id: orgId,
      change_event_id: pr.change_event_id,
      prediction_id: pr.id,
      outcome_type: outcome,
      headline,
      story_text: storyText,
      estimated_value: placeholderValue,
      confidence_level: initialConfidence,
      status: "PENDING",
      evidence_json: evidence as unknown as Record<string, unknown>,
      corrective_action_at: correctiveAt,
    });
    if (error) {
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        // eslint-disable-next-line no-console
        console.warn("value_stories insert:", error.message);
      }
      continue;
    }
    created += 1;
  }

  return { created };
}
