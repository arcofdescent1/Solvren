import type { ExecutiveDecisionApi, ExecutiveDecisionState } from "./types";

export type DecisionRow = {
  decision: ExecutiveDecisionApi;
  created_at: string;
};

export function deriveExecutiveOverlayState(decisions: DecisionRow[]): ExecutiveDecisionState {
  if (!decisions.length) return "NONE";
  const sorted = [...decisions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const last = sorted[0]!.decision;
  if (last === "APPROVE") return "APPROVED";
  if (last === "DELAY") return "DELAYED";
  if (last === "ESCALATE") return "ESCALATED";
  if (last === "REQUEST_INFO") return "REQUESTED_INFO";
  return "NONE";
}
