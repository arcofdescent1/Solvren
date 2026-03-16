"use client";

import { Card, CardBody } from "@/ui";

type Props = {
  headline: string | null;
  summary: string;
  suggestedAction?: string | null;
  topEventId?: string | null;
};

export function DashboardNarrativeSummary({ headline, summary, suggestedAction, topEventId }: Props) {
  return (
    <Card>
      <CardBody className="py-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">Highest-priority issue</h2>
        {headline && <p className="mt-2 font-semibold text-[var(--text)]">{headline}</p>}
        <p className="mt-2 text-[var(--text)]">{summary}</p>
        {suggestedAction && <p className="mt-3 text-sm font-medium text-[var(--primary)]">{suggestedAction}</p>}
        {topEventId && (
          <a href={"/risk/event/" + topEventId} className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            View risk details
          </a>
        )}
      </CardBody>
    </Card>
  );
}
