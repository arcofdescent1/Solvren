/**
 * Phase 5 — Decision result contract (§17).
 */
import type { RankedAction } from "./ranked-action";
import type { BlockedAction } from "./blocked-action";

export type DecisionResult = {
  resultStatus: "RANKED" | "NO_ELIGIBLE_ACTION" | "ERROR";

  selectedActionKey: string | null;
  rankedActions: RankedAction[];
  blockedActions: BlockedAction[];
  ineligibleActions: BlockedAction[];

  usedColdStart: boolean;
  decisionModelKey: string;
  decisionModelVersion: string;

  contextHash: string;
  decisionTraceId: string;
};
