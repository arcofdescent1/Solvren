"use client";

import * as React from "react";
import Link from "next/link";
import { trackPhase4StepViewed } from "./phase4Analytics";

export function IntegrationDepthStep() {
  React.useEffect(() => {
    trackPhase4StepViewed("increase_depth");
  }, []);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">Increase integration depth</h3>
      <p className="text-xs text-[var(--text-muted)]">
        Milestones use distinct connected integrations and enabled detector workflows. Connect more systems and turn on
        workflows that orchestrate revenue protection.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/integrations"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
        >
          Integrations
        </Link>
        <Link
          href="/marketplace/integrations"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
}
