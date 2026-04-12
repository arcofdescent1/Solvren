"use client";

import * as React from "react";
import { ExpandOrgFootprintStep } from "./ExpandOrgFootprintStep";
import { IntegrationDepthStep } from "./IntegrationDepthStep";
import { ExecutiveQBRStep } from "./ExecutiveQBRStep";
import { SystemOfRecordStep } from "./SystemOfRecordStep";
import { RenewalReadinessStep } from "./RenewalReadinessStep";
import { RenewalScoreCard } from "./RenewalScoreCard";
import { ExpansionRecommendations } from "./ExpansionRecommendations";

type State = {
  eligible: boolean;
  phase4Status: string;
  phase4RenewalScore: number;
  milestones: {
    expansionOk: boolean;
    depthOk: boolean;
    execOk: boolean;
    sorOk: boolean;
    renewalOk: boolean;
    allComplete: boolean;
  };
  thresholds: {
    businessUnitDelta: number;
    connectedIntegrations: number;
    enabledWorkflows: number;
    consecutiveExecutiveWeeks: number;
  };
  phase4ExpandedUnitCount: number;
  phase4ConnectedIntegrations: number;
  phase4EnabledWorkflows: number;
  phase4ConsecutiveExecutiveWeeks: number;
  phase4SystemOfRecordConfirmed: boolean;
};

export function EnterpriseExpansionCenter() {
  const [state, setState] = React.useState<State | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/onboarding/phase4/state");
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? "Failed to load");
      return;
    }
    const j = (await res.json()) as State & { error?: string };
    setErr(null);
    setState(j);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (err) {
    return <p className="text-sm text-[color:var(--rg-text-muted)]">{err}</p>;
  }
  if (!state) {
    return <p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>;
  }

  if (!state.eligible) {
    return (
      <p className="text-sm text-[color:var(--rg-text-muted)]">
        Phase 4 unlocks after Phase 3 completion and a maturity signal (30 days since Phase 3 completion in org timezone,
        ≥3 active value stories since Phase 3 completion, or enough active departments for your plan tier).
      </p>
    );
  }

  const m = state.milestones;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Milestone label="Org expansion" ok={m.expansionOk} detail={`+${state.thresholds.businessUnitDelta} qualifying units vs baseline`} />
        <Milestone
          label="Integration depth"
          ok={m.depthOk}
          detail={`${state.thresholds.connectedIntegrations} integrations · ${state.thresholds.enabledWorkflows} workflows`}
        />
        <Milestone
          label="Executive cadence"
          ok={m.execOk}
          detail={`${state.thresholds.consecutiveExecutiveWeeks} consecutive qualifying ISO weeks`}
        />
        <Milestone label="System of record" ok={m.sorOk} detail="Adoption signal recorded" />
        <Milestone label="Renewal readiness" ok={m.renewalOk} detail="Score ≥ 80 + qualified expansion recs" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RenewalScoreCard score={state.phase4RenewalScore} />
        <div className="lg:col-span-2 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4 text-xs text-[color:var(--rg-text-muted)]">
          <p className="font-medium text-[color:var(--rg-text)]">Cached counters (sync-owned)</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Expanded units: {state.phase4ExpandedUnitCount}</li>
            <li>Connected integrations: {state.phase4ConnectedIntegrations}</li>
            <li>Enabled workflows: {state.phase4EnabledWorkflows}</li>
            <li>Executive streak (weeks): {state.phase4ConsecutiveExecutiveWeeks}</li>
            <li>System of record: {state.phase4SystemOfRecordConfirmed ? "yes" : "no"}</li>
            <li>Status: {state.phase4Status}</li>
          </ul>
        </div>
      </div>

      <ExpansionRecommendations />

      <ExpandOrgFootprintStep onChanged={refresh} />
      <IntegrationDepthStep />
      <ExecutiveQBRStep onChanged={refresh} />
      <SystemOfRecordStep onChanged={refresh} />
      <RenewalReadinessStep />
    </div>
  );
}

function Milestone(props: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-3">
      <p className="text-xs font-medium text-[color:var(--rg-text)]">{props.label}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-[color:var(--rg-text-muted)]">
        {props.ok ? "Complete" : "In progress"}
      </p>
      <p className="mt-1 text-xs text-[color:var(--rg-text-muted)]">{props.detail}</p>
    </div>
  );
}
