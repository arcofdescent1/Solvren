"use client";

import Link from "next/link";
import { Card, CardBody } from "@/ui";

export function ValueStoryCard({
  story,
}: {
  story: {
    id: string;
    headline: string;
    outcome_type: string;
    estimated_value: number | null;
    confidence_level: string;
    status: string;
    finalized_at?: string | null;
  };
}) {
  const val = story.estimated_value ?? 0;
  const valueLabel =
    story.outcome_type === "APPROVAL_TIME_SAVED"
      ? `${Math.round(val)} hrs saved`
      : `$${Math.round(val).toLocaleString()}`;
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link href={`/outcomes/value-stories/${story.id}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
              {story.headline}
            </Link>
            <p className="text-xs text-[var(--text-muted)]">
              {story.outcome_type.replace(/_/g, " ")} · {story.confidence_level.replace(/_/g, " ")} · {story.status}
            </p>
          </div>
          <p className="text-sm font-medium tabular-nums">{valueLabel}</p>
        </div>
        {story.finalized_at ? (
          <p className="text-xs text-[var(--text-muted)]">Finalized {new Date(story.finalized_at).toLocaleString()}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
