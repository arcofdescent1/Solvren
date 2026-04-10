"use client";

import { useState } from "react";
import { IssueImpactCard } from "@/components/issues";
import { ImpactBreakdownPanel, ImpactAssumptionsDrawer } from "@/components/impact";
import type { Phase5Impact } from "@/components/issues/IssueImpactCard";

export type IssueImpactSectionProps = {
  impact: Phase5Impact | null;
  impactUnknown: boolean;
  issueId: string;
  calculationBreakdown?: Record<string, unknown> | null;
  assumptionsSnapshot?: Record<string, unknown> | null;
  confidenceExplanation?: Record<string, unknown> | null;
};

export function IssueImpactSection({
  impact,
  impactUnknown,
  issueId,
  calculationBreakdown,
  assumptionsSnapshot: _assumptionsSnapshot,
  confidenceExplanation,
}: IssueImpactSectionProps) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <IssueImpactCard
        impact={impact}
        impactUnknown={impactUnknown}
        issueId={issueId}
        onShowAssumptions={impact?.modelKey ? () => setAssumptionsOpen(true) : undefined}
      />
      {impact && (calculationBreakdown || confidenceExplanation) && (
        <ImpactBreakdownPanel
          modelKey={impact.modelKey ?? "unknown"}
          modelVersion={impact.modelVersion ?? "—"}
          calculationBreakdown={calculationBreakdown ?? null}
          confidenceExplanation={confidenceExplanation ?? null}
        />
      )}
      {impact?.modelKey && (
        <ImpactAssumptionsDrawer
          issueId={issueId}
          modelKey={impact.modelKey}
          modelVersion={impact.modelVersion ?? "—"}
          open={assumptionsOpen}
          onClose={() => setAssumptionsOpen(false)}
        />
      )}
    </div>
  );
}
