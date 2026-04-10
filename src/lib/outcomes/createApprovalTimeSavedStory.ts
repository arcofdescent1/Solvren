import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceJsonV1 } from "@/lib/outcomes/types";
import { buildObservationWindow } from "@/lib/outcomes/finalizeValueStories";
import { computeApprovalTimeSaved, getFinalApprovalCompletedAt } from "@/lib/outcomes/computeApprovalTimeSaved";
import { hasQualifyingApprovalIntervention } from "@/lib/outcomes/hasQualifyingApprovalIntervention";

/**
 * Attempt to insert APPROVAL_TIME_SAVED for one approved change (dedupe: org+change+outcome, prediction null).
 */
export async function createApprovalTimeSavedStoryIfEligible(
  admin: SupabaseClient,
  orgId: string,
  changeEventId: string,
  overrides: Record<string, number> | null
): Promise<{ created: boolean; skipReason?: string }> {
  const finalAt = await getFinalApprovalCompletedAt(admin, changeEventId);
  if (!finalAt) return { created: false, skipReason: "NO_FINAL_APPROVAL" };

  const intervention = await hasQualifyingApprovalIntervention(admin, {
    changeEventId,
    finalApprovalCompletedAt: finalAt,
  });
  if (!intervention.qualifies) {
    return { created: false, skipReason: "NO_QUALIFYING_INTERVENTION" };
  }

  const computed = await computeApprovalTimeSaved(admin, { orgId, changeEventId });
  if (!computed.ok) {
    return { created: false, skipReason: computed.reason };
  }

  const win = buildObservationWindow({
    outcomeType: "APPROVAL_TIME_SAVED",
    correctiveActionAt: finalAt,
    overrides,
  });

  const headline = `Approval cycle time reduced by ${Math.round(computed.hoursSaved)} hours`;

  const evidence: EvidenceJsonV1 = {
    schemaVersion: 1,
    predictionId: null,
    changeEventId,
    actions: [{ type: "APPROVAL_CYCLE_COMPLETED", timestamp: finalAt }],
    timelineEvents: [],
    observationWindow: { startedAt: win.startedAt, endsAt: win.endsAt },
    baselineHours: computed.baselineHours,
    actualHours: computed.actualHours,
    hoursSaved: computed.hoursSaved,
    baselineSampleSize: computed.baselineSampleSize,
    baselineScope: computed.baselineScope,
    interventionTypes: intervention.interventionTypes,
  };

  const storyText =
    "Estimated time saved relative to recent historical approval patterns. This is not presented as hard causal proof.";

  const { error } = await admin.from("value_stories").insert({
    org_id: orgId,
    change_event_id: changeEventId,
    prediction_id: null,
    outcome_type: "APPROVAL_TIME_SAVED",
    headline,
    story_text: storyText,
    estimated_value: null,
    confidence_level: "LIKELY",
    status: "PENDING",
    evidence_json: evidence as unknown as Record<string, unknown>,
    corrective_action_at: finalAt,
  });

  if (error) {
    if (String(error.message).toLowerCase().includes("duplicate")) {
      return { created: false, skipReason: "DUPLICATE" };
    }
    // eslint-disable-next-line no-console
    console.warn("approval time saved story insert:", error.message);
    return { created: false, skipReason: error.message };
  }

  return { created: true };
}

export async function detectApprovalTimeSavedForOrg(
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

  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const { data: changes } = await admin
    .from("change_events")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "APPROVED")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(150);

  for (const c of changes ?? []) {
    const id = (c as { id: string }).id;
    const r = await createApprovalTimeSavedStoryIfEligible(admin, orgId, id, overrides);
    if (r.created) created += 1;
  }

  return { created };
}
