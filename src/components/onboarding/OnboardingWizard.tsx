"use client";

/**
 * Phase 10 — Onboarding wizard (§12, §19.1).
 */
import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/ui/primitives/card";
import { Button } from "@/ui/primitives/button";

type Step = {
  stepKey: string;
  stepStatus: string;
  required: boolean;
  displayName: string;
  stepGroup: string;
};

type OnboardingData = {
  onboardingState: string;
  firstValueReached: boolean;
  currentStepKey: string | null;
  steps: Step[];
};

const STEP_GROUPS = [
  { key: "org_setup", label: "Organization" },
  { key: "integrations", label: "Integrations" },
  { key: "detection", label: "Detection" },
  { key: "playbooks", label: "Playbooks" },
  { key: "automation", label: "Automation" },
  { key: "roi", label: "Value" },
];

export function OnboardingWizard() {
  const [data, setData] = useState<OnboardingData | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/state");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchState();
    });
  }, [fetchState]);

  const markInProgress = async (stepKey: string) => {
    await fetch("/api/onboarding/step", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepKey, stepStatus: "IN_PROGRESS" }),
    });
    fetchState();
  };

  const markCompleted = async (stepKey: string) => {
    await fetch("/api/onboarding/step", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepKey, stepStatus: "COMPLETED" }),
    });
    fetchState();
  };

  if (!data || data.onboardingState === "ACTIVATED") {
    return null;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-[color:var(--rg-text)]">Get started with Solvren</h1>
      <p className="text-sm text-[color:var(--rg-text-muted)]">
        Follow these steps to connect integrations, enable playbooks, and reach your first value.
      </p>

      {STEP_GROUPS.map((group) => {
        const steps = data.steps.filter((s) => s.stepGroup === group.key);
        if (steps.length === 0) return null;

        return (
          <Card key={group.key}>
            <CardBody>
              <h2 className="mb-4 text-sm font-semibold text-[color:var(--rg-text)]">{group.label}</h2>
              <ul className="space-y-3">
                {steps.map((step) => (
                  <li
                    key={step.stepKey}
                    className="flex items-center justify-between rounded border border-[color:var(--rg-border)] p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {step.displayName}
                        {step.required && <span className="ml-1 text-[color:var(--rg-danger)]">*</span>}
                      </p>
                      <p className="text-xs text-[color:var(--rg-text-muted)]">{step.stepStatus}</p>
                    </div>
                    <div className="flex gap-2">
                      {step.stepStatus !== "COMPLETED" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markInProgress(step.stepKey)}
                          >
                            Start
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => markCompleted(step.stepKey)}
                          >
                            Done
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
