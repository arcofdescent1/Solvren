"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChangeIntakeStepper } from "./ChangeIntakeStepper";
import { INTAKE_STEPS, type IntakeDraft, type IntakeStepId } from "./types";

export function ChangeIntakeStepperClient({
  initialDraft,
  step,
}: {
  initialDraft: IntakeDraft;
  step: IntakeStepId;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<IntakeDraft>(initialDraft);
  const [saving, setSaving] = useState(false);

  const onDraftChange = useCallback((next: Partial<IntakeDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: draft.title,
        changeType: draft.change_type ?? "OTHER",
        structuredChangeType: draft.structured_change_type ?? null,
        domain: draft.domain ?? "REVENUE",
        systemsInvolved: draft.systems_involved ?? [],
        revenueImpactAreas: draft.revenue_impact_areas ?? [],
        rolloutMethod: draft.rollout_method ?? null,
        plannedReleaseAt: draft.planned_release_at ?? null,
        rollbackTimeEstimateHours: draft.rollback_time_estimate_hours ?? null,
        backfillRequired: draft.backfill_required ?? false,
        customerImpactExpected: draft.customer_impact_expected ?? false,
        affectedCustomerSegments:
          (draft.affected_customer_segments?.length ?? 0) > 0
            ? draft.affected_customer_segments
            : null,
        revenueSurface: draft.revenue_surface ?? null,
        estimatedMrrAffected: draft.estimated_mrr_affected ?? null,
        percentCustomerBaseAffected:
          draft.percent_customer_base_affected ?? null,
        description: draft.description ?? null,
      };

      const res = await fetch(`/api/changes/${draft.id}/intake`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save");
      }

      const stepIndex = INTAKE_STEPS.findIndex((s) => s.id === step);
      if (stepIndex >= 0 && stepIndex < INTAKE_STEPS.length - 1) {
        const nextStep = INTAKE_STEPS[stepIndex + 1];
        router.push(`/changes/${draft.id}/intake?step=${nextStep.id}`);
      }
      router.refresh();
    } catch {
      // Could show toast
    } finally {
      setSaving(false);
    }
  }, [draft, step, router]);

  return (
    <ChangeIntakeStepper
      draft={draft}
      step={step}
      onDraftChange={onDraftChange}
      onSave={onSave}
      saving={saving}
    />
  );
}
