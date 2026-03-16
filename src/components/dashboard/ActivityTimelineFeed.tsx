"use client";

import { Card, CardBody } from "@/ui";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";

export type ActivityTimelineFeedProps = {
  orgId: string | null;
  limit?: number;
};

export function ActivityTimelineFeed({ orgId, limit = 15 }: ActivityTimelineFeedProps) {
  if (!orgId) {
    return (
      <Card>
        <CardBody>
          <h2 className="font-semibold text-lg">Activity timeline</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Select an organization to see recent key events across changes, approvals, and risks.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardBody>
        <h2 className="mb-4 font-semibold text-lg">Activity timeline</h2>
        <ActivityTimeline orgId={orgId} limit={limit} className="[&>h3]:sr-only" />
      </CardBody>
    </Card>
  );
}
