/**
 * Phase 6 — Autonomy cap recommendations within governance envelope (advisory).
 */
export type AutonomyBandProposal = {
  parameterKey: string;
  recommendedMode: string;
  rationale: string;
};

/** Suggest conservative default when friction signals dominate (placeholder heuristic). */
export function proposeAutonomyBandFromFrictionScore(frictionScore: number): AutonomyBandProposal | null {
  if (frictionScore < 0.6) return null;
  return {
    parameterKey: "default_autonomy_cap",
    recommendedMode: "approve_then_execute",
    rationale: `Friction score ${frictionScore.toFixed(2)} suggests capping at approve_then_execute pending review`,
  };
}
