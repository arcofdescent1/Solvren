"use client";

/**
 * Phase 9 — Automation mode pill (§16.2).
 */
import { ExecutionMode } from "@/modules/autonomy-safety/domain";
import { Badge } from "@/ui/primitives/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/primitives/tooltip";

const MODE_LABELS: Record<ExecutionMode, string> = {
  [ExecutionMode.DRY_RUN]: "Dry Run",
  [ExecutionMode.SUGGEST_ONLY]: "Suggest Only",
  [ExecutionMode.APPROVAL_REQUIRED]: "Approval Required",
  [ExecutionMode.BOUNDED_AUTO]: "Bounded Auto",
  [ExecutionMode.FULL_AUTO]: "Full Auto",
};

type Props = {
  requestedMode: ExecutionMode;
  effectiveMode: ExecutionMode;
};

export function AutomationModePill({ requestedMode, effectiveMode }: Props) {
  const isDowngraded = requestedMode !== effectiveMode;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary">{MODE_LABELS[requestedMode]}</Badge>
            {isDowngraded && (
              <>
                <span className="text-[color:var(--rg-text-muted)]">→</span>
                <Badge variant="warning">{MODE_LABELS[effectiveMode]}</Badge>
              </>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isDowngraded
            ? `Requested: ${MODE_LABELS[requestedMode]}. Effective: ${MODE_LABELS[effectiveMode]} (downgraded)`
            : `Mode: ${MODE_LABELS[effectiveMode]}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
