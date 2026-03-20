"use client";

/**
 * Phase 9 — Autonomy confidence badge (§16.1).
 */
import { Badge } from "@/ui/primitives/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/primitives/tooltip";
import { AutonomyConfidenceBand } from "@/modules/autonomy-safety/domain";

const BAND_TOOLTIPS: Record<AutonomyConfidenceBand, string> = {
  [AutonomyConfidenceBand.LOW]: "Low autonomy confidence. Automation may be downgraded to approval-required.",
  [AutonomyConfidenceBand.MEDIUM]: "Medium autonomy confidence. Some automation allowed within policy bounds.",
  [AutonomyConfidenceBand.HIGH]: "High autonomy confidence. Automation path is trusted.",
};

const BAND_VARIANTS: Record<AutonomyConfidenceBand, "danger" | "warning" | "success"> = {
  [AutonomyConfidenceBand.LOW]: "danger",
  [AutonomyConfidenceBand.MEDIUM]: "warning",
  [AutonomyConfidenceBand.HIGH]: "success",
};

type Props = {
  band: AutonomyConfidenceBand;
  score?: number;
  showScore?: boolean;
};

export function AutonomyConfidenceBadge({ band, score, showScore }: Props) {
  const variant = BAND_VARIANTS[band];
  const label = showScore && score != null ? `${band} (${score})` : band;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge variant={variant}>{label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>{BAND_TOOLTIPS[band]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
