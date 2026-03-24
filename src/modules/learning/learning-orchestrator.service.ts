/**
 * Phase 6 — Central coordinator: jobs, kill switches, auditable draft outputs only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";
import { getLearningControls } from "./learning-settings";
import { runImpactThresholdCalibration } from "./calibration/calibration-engine.service";
import { generateFrictionRuleSuggestion } from "./suggestions/rule-suggestion-engine.service";
import { suggestAutonomyCalibrationDraft } from "./autonomy/autonomy-calibration.service";
import { deriveAllImplicitLabels } from "./labels/implicit-label-derivation.service";

export type OrchestratorRunKind = "calibration" | "rule_suggestions" | "autonomy" | "implicit_labels" | "all";

export async function runLearningOrchestrator(
  supabase: SupabaseClient,
  orgId: string,
  actorUserId: string,
  kind: OrchestratorRunKind,
  options?: { targetPolicyId?: string | null }
): Promise<{ ok: boolean; details: Record<string, unknown>; error?: string }> {
  const controls = await getLearningControls(supabase, orgId);
  if (controls.globalDisabled || controls.orgLearningDisabled) {
    return { ok: false, details: {}, error: "Learning disabled" };
  }

  const details: Record<string, unknown> = {};

  try {
    if (kind === "implicit_labels" || kind === "all") {
      details.implicitLabels = await deriveAllImplicitLabels(supabase, orgId);
    }
    if (kind === "calibration" || kind === "all") {
      const r = await runImpactThresholdCalibration(supabase, { orgId });
      details.calibration = { id: r.createdId, err: r.error?.message };
    }
    if (kind === "rule_suggestions" || kind === "all") {
      const r = await generateFrictionRuleSuggestion(supabase, orgId, options?.targetPolicyId ?? null);
      details.ruleSuggestion = { id: r.id, err: r.error?.message };
    }
    if (kind === "autonomy" || kind === "all") {
      const r = await suggestAutonomyCalibrationDraft(supabase, orgId);
      details.autonomySuggestion = { id: r.id, err: r.error?.message };
    }

    await auditLog(supabase, {
      orgId,
      actorId: actorUserId,
      action: "learning_orchestrator_run",
      entityType: "organization",
      entityId: orgId,
      metadata: { kind, details },
    });

    return { ok: true, details };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "orchestrator failed";
    return { ok: false, details, error: msg };
  }
}
