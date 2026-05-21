"use client";

import { Badge } from "@/ui";

type CoordinationPlanLite = {
  summary: {
    coordinationSummary: string;
    whyTheseRecommendationsExist: string;
  };
  approvals: { suggestedApprovers: Array<{ userId: string; role: string }> };
  evidence: { requiredItems: Array<{ kind: string }>; recommendedItems: Array<{ kind: string }> };
  blockers: Array<{ severity: "ERROR" | "WARNING" }>;
};

export function CoordinationSummary({ plan, stale }: { plan: CoordinationPlanLite | null; stale: boolean }) {
  if (!plan) return <div className="text-sm text-[var(--text-muted)]">No review plan has been generated yet.</div>;

  const approverCount = new Set((plan.approvals?.suggestedApprovers ?? []).map((a) => a.userId)).size;
  const requiredEvidence = plan.evidence?.requiredItems?.length ?? 0;
  const blockers = plan.blockers ?? [];
  const warningCount = blockers.filter((b) => b.severity === "WARNING").length;
  const errorCount = blockers.filter((b) => b.severity === "ERROR").length;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{approverCount} decision owner{approverCount === 1 ? "" : "s"}</Badge>
        <Badge variant="secondary">{requiredEvidence} proof item{requiredEvidence === 1 ? "" : "s"}</Badge>
        <Badge variant={errorCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success"}>
          {errorCount + warningCount} blocker{errorCount + warningCount === 1 ? "" : "s"}
        </Badge>
        {stale ? <Badge variant="warning">Needs refresh</Badge> : null}
      </div>
      {plan.summary?.coordinationSummary ? <p className="mt-3 text-[var(--text)]">{plan.summary.coordinationSummary}</p> : null}
      {plan.summary?.whyTheseRecommendationsExist ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{plan.summary.whyTheseRecommendationsExist}</p>
      ) : null}
    </div>
  );
}
