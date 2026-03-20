/**
 * Phase 10 — Activation recommendations (§13).
 */
export type RecommendationType =
  | "connect_integration"
  | "enable_playbook"
  | "complete_step"
  | "review_safe_mode"
  | "view_first_value"
  | "upgrade_execution_mode"
  | "fix_blocked_step";

export type RecommendationStatus = "OPEN" | "ACCEPTED" | "DISMISSED" | "COMPLETED";

export type ActivationRecommendation = {
  id: string;
  orgId: string;
  recommendationType: RecommendationType;
  targetKey: string;
  title: string;
  description: string;
  recommendationStatus: RecommendationStatus;
  confidenceScore: number;
  evidenceJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
