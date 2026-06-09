"use client";

import * as React from "react";
import { trackPhase4StepViewed } from "./phase4Analytics";

export function RenewalReadinessStep() {
  const [data, setData] = React.useState<{
    renewalScore: number;
    expansionRecommendationCount: number;
    milestones?: { renewalOk?: boolean };
  } | null>(null);

  React.useEffect(() => {
    trackPhase4StepViewed("prepare_for_renewal");
    void (async () => {
      const res = await fetch("/api/onboarding/phase4/renewal-readiness");
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(await res.json());
    })();
  }, []);

  if (!data) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-muted)]">
        Renewal readiness is visible to org admins only.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-xs">
      <h3 className="text-sm font-semibold text-[var(--text)]">Renewal readiness</h3>
      <p className="text-[var(--text-muted)]">
        Score: <span className="font-medium text-[var(--text)]">{data.renewalScore}</span> · Expansion
        recommendations (qualified):{" "}
        <span className="font-medium text-[var(--text)]">{data.expansionRecommendationCount}</span>
      </p>
      <p className="text-[var(--text-muted)]">
        Target: score ≥ 80 with at least one qualified expansion recommendation from activation recommendations.
      </p>
    </div>
  );
}
