"use client";

import Link from "next/link";
import { Card, CardBody } from "@/ui";
import { RiskCard } from "@/components/risk/RiskCard";

export type RiskEventForCard = {
  id: string;
  provider: string;
  object: string;
  risk_type: string;
  impact_amount: number | null;
  risk_score?: number;
  risk_bucket?: string | null;
  approved_at: string | null;
  change_event_id: string | null;
};

export type TopRiskCardListProps = {
  events: RiskEventForCard[];
  maxCards?: number;
};

export function TopRiskCardList(props: TopRiskCardListProps) {
  const { events, maxCards = 5 } = props;
  const slice = events.slice(0, maxCards);

  if (slice.length === 0) {
    return (
      <Card>
        <CardBody>
          <h2 className="font-semibold text-lg">Top revenue risks</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No revenue risks detected yet. Once monitoring is active, risks will appear here.
          </p>
          <Link href="/org/settings/integrations" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            Connect Jira to detect risks
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Top revenue risks</h2>
          <Link href="/risk/audit" className="text-sm font-medium text-[var(--primary)] hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slice.map((e) => {
            const status = e.approved_at ? "Approved" : e.change_event_id ? "Pending" : "Unapproved";
            return (
              <RiskCard
                key={e.id}
                id={e.id}
                provider={e.provider}
                object={e.object}
                riskType={e.risk_type}
                impactAmount={e.impact_amount}
                riskScore={e.risk_score}
                riskBucket={e.risk_bucket ?? undefined}
                status={status === "Unapproved" && !e.change_event_id ? "Missing" : (status as "Approved" | "Pending")}
                changeEventId={e.change_event_id}
              />
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
