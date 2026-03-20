/**
 * Phase 7 — Timeline grouping service (§12).
 * Groups events for readability. Rendering concern only.
 */
import type { RevenueTimelineEvent } from "../domain/revenue-timeline-event";

export type TimelineGroup = {
  key: string;
  events: RevenueTimelineEvent[];
  collapsedHeadline?: string;
};

const GROUP_WINDOW_MS = 15 * 60 * 1000;

export function groupTimelineEvents(
  events: RevenueTimelineEvent[],
  windowMs = GROUP_WINDOW_MS
): TimelineGroup[] {
  if (events.length === 0) return [];

  const groups: TimelineGroup[] = [];
  let current: RevenueTimelineEvent[] = [events[0]!];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]!;
    const curr = events[i]!;
    const prevTime = new Date(prev.eventTime).getTime();
    const currTime = new Date(curr.eventTime).getTime();

    if (currTime - prevTime <= windowMs && shouldGroupTogether(prev, curr)) {
      current.push(curr);
    } else {
      groups.push(toGroup(current));
      current = [curr];
    }
  }
  if (current.length > 0) {
    groups.push(toGroup(current));
  }
  return groups;
}

function shouldGroupTogether(a: RevenueTimelineEvent, b: RevenueTimelineEvent): boolean {
  const pairs: [string, string][] = [
    ["APPROVAL_REQUESTED", "APPROVAL_GRANTED"],
    ["APPROVAL_REQUESTED", "APPROVAL_REJECTED"],
    ["ACTION_RECOMMENDED", "ACTION_EXECUTED"],
    ["VERIFICATION_STARTED", "VERIFICATION_SUCCEEDED"],
    ["VERIFICATION_STARTED", "VERIFICATION_FAILED"],
  ];
  for (const [x, y] of pairs) {
    if (a.eventType === x && b.eventType === y) return true;
  }
  return false;
}

function toGroup(events: RevenueTimelineEvent[]): TimelineGroup {
  const key = events.map((e) => e.eventId).join("_");
  const collapsedHeadline =
    events.length > 1
      ? `${events[0]?.headline} → ${events[events.length - 1]?.headline}`
      : undefined;
  return { key, events, collapsedHeadline };
}
