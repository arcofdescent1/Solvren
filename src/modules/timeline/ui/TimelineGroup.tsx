"use client";

import { TimelineEventCard } from "./TimelineEventCard";
import type { TimelineGroup as TimelineGroupType } from "../services/timeline-grouping.service";

export type TimelineGroupProps = {
  group: TimelineGroupType;
  collapsed?: boolean;
  onDrillDown?: (event: TimelineGroupType["events"][0]) => void;
};

export function TimelineGroup({
  group,
  collapsed,
  onDrillDown,
}: TimelineGroupProps) {
  if (collapsed && group.collapsedHeadline) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
        <p className="text-sm text-[var(--text-muted)]">{group.collapsedHeadline}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {group.events.map((event) => (
        <TimelineEventCard
          key={event.eventId}
          event={event}
          onDrillDown={onDrillDown}
        />
      ))}
    </div>
  );
}
