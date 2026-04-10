import type { OutcomeType } from "@/lib/outcomes/types";

/** Human-readable headline for a value story (Phase 6). */
export function buildValueStoryHeadline(args: { outcomeType: OutcomeType; predictionType?: string | null }): string {
  const o = args.outcomeType.replace(/_/g, " ").toLowerCase();
  if (args.predictionType) {
    return `Outcome: ${o} — ${args.predictionType.replace(/_/g, " ").toLowerCase()}`;
  }
  return `Outcome: ${o}`;
}
