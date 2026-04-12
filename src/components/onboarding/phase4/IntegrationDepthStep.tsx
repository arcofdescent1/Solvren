"use client";

import * as React from "react";
import Link from "next/link";
import { trackPhase4StepViewed } from "./phase4Analytics";

export function IntegrationDepthStep() {
  React.useEffect(() => {
    trackPhase4StepViewed("increase_depth");
  }, []);

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[color:var(--rg-text)]">Increase integration depth</h3>
      <p className="text-xs text-[color:var(--rg-text-muted)]">
        Milestones use distinct connected integrations and enabled detector workflows. Connect more systems and turn on
        workflows that orchestrate revenue protection.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/integrations"
          className="rounded-md border border-[color:var(--rg-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--rg-text)] hover:bg-[color:var(--rg-surface-elevated)]"
        >
          Integrations
        </Link>
        <Link
          href="/marketplace/integrations"
          className="rounded-md border border-[color:var(--rg-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--rg-text)] hover:bg-[color:var(--rg-surface-elevated)]"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
}
