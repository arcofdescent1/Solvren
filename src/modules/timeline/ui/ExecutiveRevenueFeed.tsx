"use client";

import { Card, CardBody } from "@/ui";
import { TimelineEventCard } from "./TimelineEventCard";
import type { RevenueTimelineEvent } from "../domain/revenue-timeline-event";

export type ExecutiveRevenueFeedProps = {
  events: RevenueTimelineEvent[];
  compact?: boolean;
  onIssueClick?: (issueId: string) => void;
};

export function ExecutiveRevenueFeed({
  events,
  compact,
  onIssueClick,
}: ExecutiveRevenueFeedProps) {
  const displayEvents = compact ? events.slice(0, 5) : events;

  return (
    <Card>
      <CardBody>
        <h3 className="mb-4 font-semibold">Revenue Protection Activity</h3>
        {displayEvents.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--text-muted)]">
            No recent revenue events.
          </p>
        ) : (
          <ul className={`space-y-3 ${compact ? "" : ""}`}>
            {displayEvents.map((event) => (
              <li key={event.eventId}>
                <TimelineEventCard
                  event={event}
                  onDrillDown={
                    onIssueClick && event.issueId
                      ? () => onIssueClick(event.issueId!)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
