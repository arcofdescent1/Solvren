"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { MilestoneChecklist, type Phase2Milestones } from "./MilestoneChecklist";
import { Phase2ProgressSidebar } from "./Phase2ProgressSidebar";
import { TeamSetupStep } from "./TeamSetupStep";
import { RiskPrioritiesStep } from "./RiskPrioritiesStep";
import { WorkflowAlertsStep } from "./WorkflowAlertsStep";
import { ApprovalRulesStep } from "./ApprovalRulesStep";
import { FirstLiveResultStep } from "./FirstLiveResultStep";
import { phase2BasePayload, trackPhase2StepViewed } from "./phase2Analytics";

type Phase2StateJson = {
  orgId: string;
  phase2Status: string | null;
  phase2CurrentStep: string | null;
  acceptedMemberCountExcludingOwner: number;
  enabledWorkflowCount: number;
  configuredAlertChannelCount: number;
  milestones: Phase2Milestones;
  riskPriorities: unknown[];
  workflowStates: Record<string, { enabled: boolean; detectorKey: string }>;
  slack: { connected: boolean; teamId: string | null; teamName: string | null };
  notificationPreferences: Array<{ channel_type: string; destination: string }>;
};

export function ActivationWizard() {
  const router = useRouter();
  const [state, setState] = useState<Phase2StateJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const startedTracked = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding/phase2/state");
    if (res.status === 403) {
      setErr("Phase 2 unlocks after guided setup, a qualifying integration, and a completed baseline scan.");
      setState(null);
      return;
    }
    if (!res.ok) {
      setErr("Could not load activation state.");
      setState(null);
      return;
    }
    const j = (await res.json()) as Phase2StateJson;
    setErr(null);
    setState(j);
    if (j.phase2Status === "COMPLETED") {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!state || startedTracked.current) return;
    startedTracked.current = true;
    trackAppEvent("onboarding_phase2_started", phase2BasePayload(state.orgId, state.phase2Status, state.phase2CurrentStep));
  }, [state]);

  useEffect(() => {
    if (!state?.phase2CurrentStep) return;
    trackPhase2StepViewed(state.orgId, state.phase2Status, state.phase2CurrentStep, state.phase2CurrentStep);
  }, [state?.phase2CurrentStep, state?.orgId, state?.phase2Status]);

  const step = state?.phase2CurrentStep ?? "team_setup";

  const slackPref = state?.notificationPreferences?.find((p) => p.channel_type === "slack");
  const initialChannelId = slackPref?.destination?.includes(":") ? slackPref.destination.split(":")[1] ?? "" : "";

  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (!state) {
    return <p className="text-sm text-[var(--text-muted)]">Loading activation…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-4">
        <Phase2ProgressSidebar currentStepKey={step} />
        <MilestoneChecklist milestones={state.milestones} />
      </div>
      <Stack gap={4}>
        {step === "team_setup" ? (
          <>
            <TeamSetupStep
              orgId={state.orgId}
              phase2Status={state.phase2Status}
              currentStepKey={state.phase2CurrentStep}
              acceptedMemberCount={state.acceptedMemberCountExcludingOwner}
              onRefresh={load}
            />
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => void load()}>
                Refresh status
              </Button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              When two teammates beyond the owner have accepted, the next step unlocks automatically on refresh.
            </p>
          </>
        ) : null}

        {step === "risk_priorities" ? (
          <RiskPrioritiesStep
            orgId={state.orgId}
            phase2Status={state.phase2Status}
            currentStepKey={state.phase2CurrentStep}
            initialCategories={(state.riskPriorities as Array<{ category: string; priority_rank: number }> | undefined)
              ?.slice()
              .sort((a, b) => a.priority_rank - b.priority_rank)
              .map((r) => r.category)}
            initialDepartments={(() => {
              const first = (state.riskPriorities as Array<{ departments?: unknown }> | undefined)?.[0];
              const d = first?.departments;
              return Array.isArray(d) ? (d as string[]).join(", ") : "";
            })()}
            onRefresh={load}
          />
        ) : null}

        {step === "workflow_alerts" ? (
          <WorkflowAlertsStep
            orgId={state.orgId}
            phase2Status={state.phase2Status}
            currentStepKey={state.phase2CurrentStep}
            workflowStates={state.workflowStates}
            slack={state.slack}
            initialChannelId={initialChannelId}
            onRefresh={load}
          />
        ) : null}

        {step === "approval_rules" ? (
          <ApprovalRulesStep orgId={state.orgId} phase2Status={state.phase2Status} currentStepKey={state.phase2CurrentStep} onRefresh={load} />
        ) : null}

        {step === "first_live_result" ? (
          <FirstLiveResultStep
            orgId={state.orgId}
            phase2Status={state.phase2Status}
            currentStepKey={state.phase2CurrentStep}
            allComplete={state.milestones.allComplete}
            onRefresh={load}
          />
        ) : null}
      </Stack>
    </div>
  );
}
