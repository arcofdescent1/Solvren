"use client";

import { Card, CardBody } from "@/ui";

export type HeroData = {
  window: string;
  recoveredAmount: number;
  avoidedAmount: number;
  operationalSavingsAmount: number;
  realizedLossAmount: number;
  activeHighValueIssueCount: number;
  recentEvents: Array<{
    eventId: string;
    headline: string;
    amount?: number | null;
    valueType?: string | null;
    eventTime: string;
    issueId?: string | null;
  }>;
};

export type RevenueHeroPanelProps = {
  data: HeroData;
  onIssueClick?: (issueId: string) => void;
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenueHeroPanel({ data, onIssueClick }: RevenueHeroPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Recovered
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--success)]">
              {formatMoney(data.recoveredAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Avoided Loss
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--primary)]">
              {formatMoney(data.avoidedAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Operational Savings
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatMoney(data.operationalSavingsAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Active High-Value Issues
            </p>
            <p className="mt-1 text-xl font-semibold">
              {data.activeHighValueIssueCount}
            </p>
          </CardBody>
        </Card>
      </div>

      {data.recentEvents.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="mb-3 font-semibold">Recent Revenue Events</h3>
            <ul className="space-y-2">
              {data.recentEvents.map((e) => (
                <li
                  key={e.eventId}
                  className={`flex items-center justify-between text-sm ${
                    onIssueClick && e.issueId ? "cursor-pointer hover:underline" : ""
                  }`}
                  onClick={() => e.issueId && onIssueClick?.(e.issueId)}
                >
                  <span className="text-[var(--text)]">{e.headline}</span>
                  <span className="text-[var(--text-muted)]">
                    {e.amount != null
                      ? formatMoney(e.amount)
                      : new Date(e.eventTime).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
