"use client";

/**
 * Phase 9 — Automation safety panel (§16.3).
 */
import { useCallback, useEffect, useState } from "react";
import { AutonomyConfidenceBadge } from "./AutonomyConfidenceBadge";
import { AutomationModePill } from "./AutomationModePill";
import { ExecutionMode } from "@/modules/autonomy-safety/domain";
import { AutonomyConfidenceBand } from "@/modules/autonomy-safety/domain";

export type AutonomyState = {
  requestedMode: string;
  effectiveMode: string;
  autonomyConfidenceScore: number;
  autonomyConfidenceBand: string;
  downgradeReasonCodes: string[];
  pauseReasonCodes: string[];
};

type Props = {
  issueId?: string | null;
  workflowRunId?: string | null;
  actionKey?: string | null;
  playbookKey?: string | null;
  orgId?: string | null;
};

export function AutomationSafetyPanel(props: Props) {
  const [state, setState] = useState<AutonomyState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    const params = new URLSearchParams();
    if (props.orgId) params.set("orgId", props.orgId);
    if (props.issueId) params.set("issueId", props.issueId);
    if (props.workflowRunId) params.set("workflowRunId", props.workflowRunId);
    if (props.actionKey) params.set("actionKey", props.actionKey);
    if (props.playbookKey) params.set("playbookKey", props.playbookKey);

    try {
      const res = await fetch(`/api/autonomy/state?${params}`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [props.orgId, props.issueId, props.workflowRunId, props.actionKey, props.playbookKey]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] p-4">
        <p className="text-sm text-[color:var(--rg-text-muted)]">Loading autonomy state…</p>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--rg-text)]">Automation Safety</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Mode</dt>
          <dd>
            <AutomationModePill
              requestedMode={state.requestedMode as ExecutionMode}
              effectiveMode={state.effectiveMode as ExecutionMode}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Confidence</dt>
          <dd>
            <AutonomyConfidenceBadge
              band={state.autonomyConfidenceBand as AutonomyConfidenceBand}
              score={state.autonomyConfidenceScore}
              showScore
            />
          </dd>
        </div>
        {state.downgradeReasonCodes.length > 0 && (
          <div>
            <dt className="mb-1 text-[color:var(--rg-text-muted)]">Downgrade reasons</dt>
            <dd className="text-xs text-[color:var(--rg-text-muted)]">
              {state.downgradeReasonCodes.join(", ")}
            </dd>
          </div>
        )}
        {state.pauseReasonCodes.length > 0 && (
          <div>
            <dt className="mb-1 text-[color:var(--rg-text-muted)]">Pause reasons</dt>
            <dd className="text-xs text-[color:var(--rg-text-muted)]">
              {state.pauseReasonCodes.join(", ")}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
