"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/ui/primitives/sheet";
import { Badge } from "@/ui";
import type { RankedAction } from "../domain/ranked-action";
import type { BlockedAction } from "../domain/blocked-action";

export type DecisionExplanationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAction: RankedAction | null;
  blockedActions: BlockedAction[];
  ineligibleActions: BlockedAction[];
  usedColdStart?: boolean;
  decisionModelKey?: string;
  decisionModelVersion?: string;
};

export function DecisionExplanationDrawer({
  open,
  onOpenChange,
  selectedAction,
  blockedActions,
  ineligibleActions,
  usedColdStart,
  decisionModelKey,
  decisionModelVersion,
}: DecisionExplanationDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Decision explanation</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {selectedAction && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">
                Selected action
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                {selectedAction.explanationText}
              </p>
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Feature breakdown
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(selectedAction.featureBreakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-[var(--text-muted)]">
                        {k.replace(/Norm$/, "").replace(/([A-Z])/g, " $1").trim()}
                      </dt>
                      <dd className="font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedAction.explanationCodes.map((code) => (
                  <Badge key={code} variant="secondary" className="text-xs">
                    {code}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {blockedActions.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">
                Blocked actions
              </h4>
              <ul className="space-y-2">
                {blockedActions.map((b) => (
                  <li
                    key={b.actionKey}
                    className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{b.actionKey}</span>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {b.reasonText}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ineligibleActions.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">
                Ineligible actions
              </h4>
              <ul className="space-y-2">
                {ineligibleActions.map((i) => (
                  <li
                    key={i.actionKey}
                    className="rounded border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{i.actionKey}</span>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {i.reasonText}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
              Metadata
            </h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Cold-start</dt>
                <dd>{usedColdStart ? "Yes" : "No"}</dd>
              </div>
              {decisionModelKey && (
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Model</dt>
                  <dd>{decisionModelKey} {decisionModelVersion ? `v${decisionModelVersion}` : ""}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
