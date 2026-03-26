import type { HomeExposureMetric } from "./types";

export function formatEstimatedExposure(amount: number | null) {
  if (amount == null || amount <= 0) return null;
  return `~${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount
  )} estimated`;
}

export function buildExposureMetrics(input: {
  openHighImpactIssues: number;
  highImpactChanges: number;
  overdueItems: number;
  linkedIncidents: number;
}): HomeExposureMetric[] {
  return [
    {
      label: "Open high-impact issues",
      value: String(input.openHighImpactIssues),
      tooltip:
        "Issues currently open and categorized as high-impact based on severity or risk classifications.",
    },
    {
      label: "High-impact changes in flight",
      value: String(input.highImpactChanges),
      tooltip:
        "Changes in active states with high or critical risk classification, or equivalent fallback impact signal.",
    },
    {
      label: "Items overdue",
      value: String(input.overdueItems),
      tooltip: "Changes and follow-up work that have passed due date or are escalated.",
    },
    {
      label: "Items linked to incidents",
      value: String(input.linkedIncidents),
      tooltip:
        "Open work connected to incidents or issue records that may indicate broader revenue-critical impact.",
    },
  ];
}
