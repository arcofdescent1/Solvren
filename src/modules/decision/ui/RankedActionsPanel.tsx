"use client";

import { Card, CardBody, Badge } from "@/ui";
import type { RankedAction } from "../domain/ranked-action";

export type RankedActionsPanelProps = {
  rankedActions: RankedAction[];
  selectedActionKey: string | null;
  usedColdStart?: boolean;
  decisionModelVersion?: string;
};

export function RankedActionsPanel({
  rankedActions,
  selectedActionKey,
  usedColdStart,
  decisionModelVersion,
}: RankedActionsPanelProps) {
  if (rankedActions.length === 0) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-[var(--text)]">Ranked actions</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No eligible actions to display.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">Ranked actions</h3>
          {usedColdStart && (
            <Badge variant="secondary" className="text-xs">
              Cold-start
            </Badge>
          )}
          {decisionModelVersion && (
            <span className="text-xs text-[var(--text-muted)]">v{decisionModelVersion}</span>
          )}
        </div>
        <ul className="space-y-2">
          {rankedActions.map((action) => {
            const isSelected = action.actionKey === selectedActionKey;
            return (
              <li
                key={action.actionKey}
                className={`rounded-lg border px-3 py-2 ${
                  isSelected
                    ? "border-[var(--primary)]/60 bg-[var(--primary)]/5"
                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isSelected
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--bg-surface-2)] text-[var(--text-muted)]"
                      }`}
                    >
                      {action.rank}
                    </span>
                    <span className="font-medium text-[var(--text)]">{action.actionKey}</span>
                    {action.approvalRequired && (
                      <Badge variant="outline" className="text-xs">
                        Approval required
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-sm text-[var(--text-muted)]">
                    {action.weightedScore.toFixed(1)}
                  </span>
                </div>
                {action.featureBreakdown.confidenceNorm < 70 && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Lower confidence ({action.featureBreakdown.confidenceNorm}%)
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
