export type OnboardingPhaseSummary =
  | "not_started"
  | "phase_1_in_progress"
  | "phase_2_in_progress"
  | "phase_3_in_progress"
  | "phase_4_in_progress"
  | "complete"
  | "unknown";

type OnboardingRow = {
  guided_phase1_status?: string | null;
  phase2_status?: string | null;
  phase3_status?: string | null;
  phase4_status?: string | null;
};

function phaseDone(s: string | null | undefined): boolean {
  const u = String(s ?? "").toUpperCase();
  return u === "COMPLETED" || u === "SKIPPED";
}

/**
 * Furthest incomplete guided phase; all terminal → complete.
 * Phase 2+ with null status after prior phase done counts as not yet complete for that phase.
 */
export function onboardingPhaseSummaryFromState(row: OnboardingRow | null | undefined): OnboardingPhaseSummary {
  if (!row) return "not_started";

  const p1 = row.guided_phase1_status ?? null;
  if (!phaseDone(p1)) {
    if (p1 == null || String(p1).toUpperCase() === "NOT_STARTED") return "not_started";
    return "phase_1_in_progress";
  }

  if (!phaseDone(row.phase2_status)) return "phase_2_in_progress";
  if (!phaseDone(row.phase3_status)) return "phase_3_in_progress";
  if (!phaseDone(row.phase4_status)) return "phase_4_in_progress";

  return "complete";
}
