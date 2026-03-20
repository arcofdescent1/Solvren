"use client";

/**
 * Phase 10 — Onboarding checklist (§19.2).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/ui/primitives/badge";
import { Card, CardBody } from "@/ui/primitives/card";

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
  milestones: Array<{ milestoneKey: string; reached: boolean }>;
};

export function OnboardingChecklist() {
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
    fetchState();
  }, [fetchState]);

  if (!data || data.onboardingState === "ACTIVATED" || data.firstValueReached) {
    return null;
  }

  const completedCount = data.steps.filter((s) => s.stepStatus === "COMPLETED").length;
  const totalRequired = data.steps.filter((s) => s.required).length;

  return (
    <Card>
      <CardBody>
        <h3 className="mb-3 text-sm font-semibold text-[color:var(--rg-text)]">Getting Started</h3>
        <p className="mb-4 text-xs text-[color:var(--rg-text-muted)]">
          {completedCount} of {totalRequired} required steps completed
        </p>
        <ul className="space-y-2">
          {data.steps.map((step) => (
            <li key={step.stepKey} className="flex items-center justify-between gap-2 text-sm">
              <span className={step.stepStatus === "COMPLETED" ? "text-[color:var(--rg-text-muted)] line-through" : ""}>
                {step.displayName}
              </span>
              <Badge
                variant={
                  step.stepStatus === "COMPLETED"
                    ? "success"
                    : step.stepStatus === "BLOCKED"
                      ? "danger"
                      : "secondary"
                }
              >
                {step.stepStatus}
              </Badge>
            </li>
          ))}
        </ul>
        <Link
          href="/onboarding"
          className="mt-4 inline-block text-sm font-medium text-[color:var(--rg-primary)] hover:underline"
        >
          Continue setup →
        </Link>
      </CardBody>
    </Card>
  );
}
