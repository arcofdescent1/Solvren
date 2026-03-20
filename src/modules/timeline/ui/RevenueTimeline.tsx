"use client";

import { TimelineGroup } from "./TimelineGroup";
import { groupTimelineEvents } from "../services/timeline-grouping.service";
import type { RevenueTimelineEvent } from "../domain/revenue-timeline-event";

export type RevenueTimelineProps = {
  events: RevenueTimelineEvent[];
  groupWindowMinutes?: number;
  showIncompleteMessage?: boolean;
  incompleteStages?: string[];
  onDrillDown?: (event: RevenueTimelineEvent) => void;
};

export function RevenueTimeline({
  events,
  groupWindowMinutes = 15,
  showIncompleteMessage,
  incompleteStages,
  onDrillDown,
}: RevenueTimelineProps) {
  const windowMs = groupWindowMinutes * 60 * 1000;
  const groups = groupTimelineEvents(events, windowMs);

  return (
    <div className="space-y-4">
      {groups.length === 0 && showIncompleteMessage ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          No timeline events yet. {incompleteStages?.length ? `${incompleteStages.join(", ")} not yet available.` : ""}
        </p>
      ) : (
        groups.map((group) => (
          <TimelineGroup
            key={group.key}
            group={group}
            onDrillDown={onDrillDown}
          />
        ))
      )}
      {showIncompleteMessage && incompleteStages && incompleteStages.length > 0 && events.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          {incompleteStages.map((s) => `${s} not yet available`).join(". ")}
        </p>
      )}
    </div>
  );
}
