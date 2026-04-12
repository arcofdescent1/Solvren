"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { AdoptionMilestoneChecklist, type Phase3Milestones } from "./AdoptionMilestoneChecklist";
import { Phase3ProgressSidebar } from "./Phase3ProgressSidebar";
import { ExpandCoverageStep } from "./ExpandCoverageStep";
import { InviteMoreTeamsStep } from "./InviteMoreTeamsStep";
import { ExecutiveVisibilityStep } from "./ExecutiveVisibilityStep";
import { ProveValueStep } from "./ProveValueStep";
import { BuildHabitStep } from "./BuildHabitStep";
import { phase3BasePayload, trackPhase3StepViewed } from "./phase3Analytics";

type Phase3StateJson = {
  orgId: string;
  eligible: boolean;
  phase3Status: string | null;
  phase3CurrentStep: string | null;
  expandedIntegrationCount: number;
  activeDepartmentCount: number;
  phase3UsageInteractionCount: number;
  phase3ActiveWeeks: number;
  milestones: Phase3Milestones;
  departmentMemberCounts: Record<string, number>;
};

export function AdoptionWizard() {
  const router = useRouter();
  const [state, setState] = useState<Phase3StateJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const completedTracked = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/phase3/state");
    if (res.status === 403) {
      setErr("Phase 3 is available after Phase 2 activation completes.");
      setState(null);
      return;
    }
    if (!res.ok) {
      setErr("Could not load adoption state.");
      setState(null);
      return;
    }
    const j = (await res.json()) as Phase3StateJson;
    setErr(null);
    setState(j);
    if (j.milestones.allComplete && j.phase3Status === "COMPLETED" && !completedTracked.current) {
      completedTracked.current = true;
      trackAppEvent("onboarding_phase3_completed", phase3BasePayload(j.orgId, j.phase3Status, j.phase3CurrentStep));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!state?.phase3CurrentStep) return;
    trackPhase3StepViewed(state.orgId, state.phase3Status, state.phase3CurrentStep, state.phase3CurrentStep);
  }, [state?.phase3CurrentStep, state?.orgId, state?.phase3Status]);

  const step = state?.phase3CurrentStep ?? "expand_coverage";

  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (!state) {
    return <p className="text-sm text-[var(--text-muted)]">Loading adoption…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-4">
        <Phase3ProgressSidebar currentStepKey={step} />
        <AdoptionMilestoneChecklist milestones={state.milestones} />
      </div>
      <Stack gap={4}>
        {!state.eligible ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Phase 3 entry unlocks when Phase 2 is complete, operational activity exists, an active policy or workflow is on, and either 7
            days have passed since activation completion or 3+ distinct operational events occurred since then. Keep using Solvren — we will
            pick this up automatically.
          </p>
        ) : null}
        {state.phase3Status === "COMPLETED" ? (
          <p className="text-sm font-medium text-[var(--primary)]">
            Phase 3 complete — Solvren is embedded across expansion, teams, executives, proof, and weekly rhythm.
          </p>
        ) : null}
        {state.phase3Status === "WAITING_FOR_VALUE_PROOF" ? (
          <p className="text-sm text-[var(--text-muted)]">
            Waiting for the first canonical value story generated from real data. Other milestones can still progress.
          </p>
        ) : null}

        {step === "expand_coverage" ? (
          <ExpandCoverageStep
            orgId={state.orgId}
            phase3Status={state.phase3Status}
            currentStepKey={state.phase3CurrentStep}
            expandedCount={state.expandedIntegrationCount}
            onRefresh={load}
          />
        ) : null}
        {step === "invite_more_teams" ? (
          <InviteMoreTeamsStep
            departmentMemberCounts={state.departmentMemberCounts}
            activeDepartmentCount={state.activeDepartmentCount}
            onRefresh={load}
          />
        ) : null}
        {step === "executive_visibility" ? <ExecutiveVisibilityStep /> : null}
        {step === "prove_value" ? (
          <ProveValueStep orgId={state.orgId} phase3Status={state.phase3Status} currentStepKey={state.phase3CurrentStep} />
        ) : null}
        {step === "build_habit" ? (
          <BuildHabitStep interactionCount={state.phase3UsageInteractionCount} activeWeeks={state.phase3ActiveWeeks} />
        ) : null}

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh progress
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </Stack>
    </div>
  );
}
