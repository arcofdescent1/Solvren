"use client";

import { Badge } from "@/ui";
import type { RevenueTimelineEvent } from "../domain/revenue-timeline-event";

const CATEGORY_ICONS: Record<string, string> = {
  DETECTION: "🔍",
  IMPACT: "📊",
  DECISION: "⚡",
  APPROVAL: "✅",
  ACTION: "▶️",
  VERIFICATION: "✓",
  OUTCOME: "💰",
  SYSTEM: "⚙️",
};

function formatAmount(amount: number, currencyCode: string, valueType: string): string {
  const prefix = valueType === "RECOVERED" ? "Recovered" : valueType === "AVOIDED" ? "Avoided Loss" : valueType === "SAVINGS" ? "Savings" : valueType === "LOSS" ? "Realized Loss" : "";
  return `${prefix}: $${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export type TimelineEventCardProps = {
  event: RevenueTimelineEvent;
  onDrillDown?: (event: RevenueTimelineEvent) => void;
};

export function TimelineEventCard({ event, onDrillDown }: TimelineEventCardProps) {
  const icon = CATEGORY_ICONS[event.category] ?? "•";
  const statusVariant =
    event.status === "SUCCESS"
      ? "success"
      : event.status === "WARNING"
        ? "warning"
        : event.status === "ERROR"
          ? "danger"
          : "outline";

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        onDrillDown ? "cursor-pointer hover:bg-[var(--bg-surface-2)]" : ""
      }`}
      onClick={() => onDrillDown?.(event)}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-[var(--text)]">{event.headline}</h4>
            {event.status && (
              <Badge variant={statusVariant}>{event.status}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{event.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>
              {new Date(event.eventTime).toLocaleString()}
            </span>
            {event.amount != null &&
              event.currencyCode &&
              event.valueType && (
                <span className="font-medium text-[var(--primary)]">
                  {formatAmount(event.amount, event.currencyCode, event.valueType)}
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
