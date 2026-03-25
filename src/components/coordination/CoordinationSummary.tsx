"use client";

type CoordinationPlanLite = {
  summary: {
    coordinationSummary: string;
    whyTheseRecommendationsExist: string;
  };
  approvals: { suggestedApprovers: Array<{ userId: string; role: string }> };
  evidence: { requiredItems: Array<{ kind: string }>; recommendedItems: Array<{ kind: string }> };
  blockers: Array<{ severity: "ERROR" | "WARNING" }>;
};

export function CoordinationSummary({
  plan,
  stale,
}: {
  plan: CoordinationPlanLite | null;
  stale: boolean;
}) {
  if (!plan) {
    return <div className="text-sm text-[var(--text-muted)]">No Coordination Plan generated yet.</div>;
  }

  const approverCount = new Set(plan.approvals.suggestedApprovers.map((a) => a.userId)).size;
  const requiredEvidence = plan.evidence.requiredItems.length;
  const warningCount = plan.blockers.filter((b) => b.severity === "WARNING").length;
  const errorCount = plan.blockers.filter((b) => b.severity === "ERROR").length;

  return (
    <div className="rounded border border-[var(--border)] bg-white p-3 text-sm shadow-sm space-y-1">
      <div className="font-semibold">Coordination Summary</div>
      <div>{plan.summary.coordinationSummary}</div>
      <div className="text-xs text-[var(--text-muted)]">{plan.summary.whyTheseRecommendationsExist}</div>
      <div>Suggested approvers: {approverCount}</div>
      <div>Required evidence suggestions: {requiredEvidence}</div>
      <div>Blockers: {errorCount} errors, {warningCount} warnings</div>
      {stale ? (
        <div className="text-xs text-yellow-700">
          This Coordination Plan may be outdated because the change or governance mappings were updated after generation.
        </div>
      ) : null}
    </div>
  );
}
