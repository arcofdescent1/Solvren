import type { ExecutiveChangeView } from "./types";
import { getAttentionSummaryLines } from "@/lib/attention/getInterruptionReason";

/** Max 3 bullets, server-side copy — aligned with Phase 2 attention driver stack. */
export function getAttentionSummary(view: ExecutiveChangeView): string[] {
  const hasExec = view.signoffs.pending.some((p) => p.toUpperCase() === "EXEC");
  return getAttentionSummaryLines({
    view,
    userPendingApprovalAreas: [],
    hasExecSignoffRequired: hasExec,
  });
}
