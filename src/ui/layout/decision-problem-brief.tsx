import type { ReactNode } from "react";
import { Card, CardBody } from "@/ui/primitives/card";
import { Stack } from "@/ui/layout/stack";

export type DecisionProblemBriefMetric = {
  label: string;
  value: ReactNode;
  helper?: string;
};

export type DecisionProblemBriefFact = {
  label: string;
  value: ReactNode;
};

export type DecisionProblemBriefProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  badges?: ReactNode;
  metrics: DecisionProblemBriefMetric[];
  nextTitle: string;
  nextBody: ReactNode;
  nextActions?: ReactNode;
  facts?: DecisionProblemBriefFact[];
};

export function DecisionProblemBrief({
  eyebrow,
  title,
  description,
  badges,
  metrics,
  nextTitle,
  nextBody,
  nextActions,
  facts = [],
}: DecisionProblemBriefProps) {
  return (
    <Card className="border-[var(--primary)]/25 shadow-sm">
      <CardBody className="p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
          <div className="space-y-5 p-6">
            {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">{eyebrow}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--text)]">{title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                  <p className="text-xs font-medium text-[var(--text-muted)]">{metric.label}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">{metric.value}</p>
                  {metric.helper ? <p className="mt-1 text-xs text-[var(--text-muted)]">{metric.helper}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <aside className="border-t border-[var(--border)] bg-[var(--card-cap-bg)] p-6 lg:border-l lg:border-t-0">
            <h3 className="text-base font-semibold">{nextTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{nextBody}</p>
            {facts.length > 0 ? (
              <div className="mt-5 space-y-3 text-sm">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                    <span className="text-[var(--text-muted)]">{fact.label}</span>
                    <span className="text-right font-semibold text-[var(--text)]">{fact.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {nextActions ? (
              <Stack direction="row" gap={2} className="mt-5 flex-wrap">
                {nextActions}
              </Stack>
            ) : null}
          </aside>
        </div>
      </CardBody>
    </Card>
  );
}
