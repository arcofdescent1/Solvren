export const PHASE3_QUALIFYING_INTERACTION_TYPES = [
  "issue_reviewed",
  "approval_decision",
  "alert_clicked",
  "workflow_configured",
  "executive_summary_opened",
  "value_story_viewed",
  "integration_connected",
] as const;

export type Phase3QualifyingInteractionType = (typeof PHASE3_QUALIFYING_INTERACTION_TYPES)[number];

export function isPhase3QualifyingInteractionType(v: string): v is Phase3QualifyingInteractionType {
  return (PHASE3_QUALIFYING_INTERACTION_TYPES as readonly string[]).includes(v);
}
