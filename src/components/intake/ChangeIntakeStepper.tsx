"use client";

import { Button, Card, CardBody, PageHeader } from "@/ui";
import Link from "next/link";
import { WIZARD_STEPS, type IntakeDraft, type IntakeStepId } from "./types";
import { SystemsStep } from "./steps/SystemsStep";
import { ChangeTypeStep } from "./steps/ChangeTypeStep";
import { DescribeStep } from "./steps/DescribeStep";
import { RevenueImpactStep } from "./steps/RevenueImpactStep";
import { CustomerImpactStep } from "./steps/CustomerImpactStep";
import { RolloutStep } from "./steps/RolloutStep";
import { EvidenceStep } from "./steps/EvidenceStep";
import { ApprovalsStep } from "./steps/ApprovalsStep";
import { ReviewSubmitStep } from "./steps/ReviewSubmitStep";
import { ChangeAssistPanel } from "@/components/ai/ChangeAssistPanel";

export function ChangeIntakeStepper({
  draft,
  step,
  onDraftChange,
  onSave,
  saving,
}: {
  draft: IntakeDraft;
  step: IntakeStepId;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const currentIndex = stepIndex >= 0 ? stepIndex : 0;
  const total = WIZARD_STEPS.length;
  const pct = Math.round(((currentIndex + 0.5) / total) * 100);

  const stepProps = {
    draft,
    onDraftChange,
    onSave,
    saving,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Changes", href: "/changes" },
          { label: draft.title || "New change", href: `/changes/${draft.id}` },
          { label: "Guided intake" },
        ]}
        title="Create revenue change"
        description={
          <span className="text-sm text-[var(--text-muted)]">
            Step {currentIndex + 1} of {total} · {pct}% complete
          </span>
        }
      />

      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)]">
          Step {currentIndex + 1} of {total}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0">
          <nav className="sticky top-4 space-y-0.5 rounded-lg border p-2 bg-[var(--bg-surface)]">
            {WIZARD_STEPS.map((s, i) => {
              const isCurrent = s.id === step;
              const isPast = i < currentIndex;
              const href =
                draft.id && (isPast || isCurrent)
                  ? `/changes/${draft.id}/intake?step=${s.id}`
                  : "#";
              return (
                <Link
                  key={s.id}
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    isCurrent
                      ? "bg-[var(--primary)] text-[var(--primary-contrast)] font-medium"
                      : isPast
                        ? "text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)]"
                        : "text-[var(--text-muted)] opacity-60"
                  }`}
                >
                  {isPast ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="w-5 text-center font-mono text-xs">
                      {i + 1}
                    </span>
                  )}
                  {s.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <Card>
            <CardBody>
              {step === "change-type" && <ChangeTypeStep {...stepProps} />}
              {step === "systems" && <SystemsStep {...stepProps} />}
              {step === "describe" && <DescribeStep {...stepProps} />}
              {step === "revenue" && <RevenueImpactStep {...stepProps} />}
              {step === "customer" && <CustomerImpactStep {...stepProps} />}
              {step === "rollout" && <RolloutStep {...stepProps} />}
              {step === "evidence" && <EvidenceStep {...stepProps} />}
              {step === "approvals" && <ApprovalsStep {...stepProps} />}
              {step === "review" && <ReviewSubmitStep {...stepProps} />}
            </CardBody>
          </Card>
        </main>

        <aside className="hidden xl:block w-80 shrink-0">
          <ChangeAssistPanel
            contextText={[draft.title ?? "", draft.description ?? ""].filter(Boolean).join("\n")}
            currentChangeType={draft.change_type ?? draft.structured_change_type}
            onApply={(applied) => {
              onDraftChange({
                change_type: applied.change_type,
                structured_change_type: applied.change_type,
                ...(applied.system && {
                  systems_involved: [...(draft.systems_involved ?? []), applied.system].filter(
                    (v, i, a) => a.indexOf(v) === i
                  ),
                }),
              });
            }}
          />
        </aside>
      </div>
    </div>
  );
}
