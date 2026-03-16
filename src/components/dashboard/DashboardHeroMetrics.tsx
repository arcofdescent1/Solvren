"use client";

import { useState } from "react";
import { Card, CardBody } from "@/ui";
import { MetricExplanationModal, type MetricKey } from "./MetricExplanationModal";

export type DashboardHeroMetricsProps = {
  totalExposure: number;
  highRiskEvents: number;
  unapprovedChanges: number;
  complianceRate: number;
  showCalculationDetails?: boolean;
};

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ExplainLink({
  label,
  metricKey,
  displayValue,
  showCalculationDetails,
  onOpen,
}: {
  label: string;
  metricKey: MetricKey;
  displayValue: string;
  showCalculationDetails: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-xs font-medium text-[var(--primary)] hover:underline"
      aria-label={`Explain ${label}`}
    >
      Explain
    </button>
  );
}

export function DashboardHeroMetrics({
  totalExposure,
  highRiskEvents,
  unapprovedChanges,
  complianceRate,
  showCalculationDetails = false,
}: DashboardHeroMetricsProps) {
  const [explainMetric, setExplainMetric] = useState<{ key: MetricKey; value: string } | null>(null);
  const exposureLevel =
    totalExposure > 500_000 ? "HIGH" : totalExposure > 100_000 ? "Medium" : "Low";

  return (
    <>
      <Card className="border-[var(--primary)]/40 bg-gradient-to-br from-[var(--primary)]/10 to-transparent transition-shadow duration-200 hover:shadow-md">
        <CardBody className="py-6">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Revenue Exposure Today
            </h2>
            <ExplainLink
              label="Revenue Exposure"
              metricKey="revenue_exposure"
              displayValue={formatMoney(totalExposure)}
              showCalculationDetails={showCalculationDetails}
              onOpen={() => setExplainMetric({ key: "revenue_exposure", value: formatMoney(totalExposure) })}
            />
          </div>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text)]">
            {formatMoney(totalExposure)}
          </p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1 rounded-full bg-[var(--bg-muted)] p-1">
            <div
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                exposureLevel === "Low" ? "bg-emerald-500" : "bg-[var(--border)]"
              }`}
            />
            <div
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                exposureLevel === "Medium" ? "bg-[var(--warning)]" : "bg-[var(--border)]"
              }`}
            />
            <div
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                exposureLevel === "HIGH" ? "bg-[var(--danger)]" : "bg-[var(--border)]"
              }`}
            />
          </div>
          <span
            className={`shrink-0 text-xs font-semibold ${
              exposureLevel === "HIGH"
                ? "text-[var(--danger)]"
                : exposureLevel === "Medium"
                  ? "text-[var(--warning)]"
                  : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {exposureLevel}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-1">
            <strong className="text-[var(--text)]">{highRiskEvents}</strong>{" "}
            <span className="text-[var(--text-muted)]">High Risk Events</span>
            <ExplainLink
              label="High Risk Events"
              metricKey="open_risk_events"
              displayValue={String(highRiskEvents)}
              showCalculationDetails={showCalculationDetails}
              onOpen={() => setExplainMetric({ key: "open_risk_events", value: String(highRiskEvents) })}
            />
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-[var(--text)]">{unapprovedChanges}</strong>{" "}
            <span className="text-[var(--text-muted)]">Unapproved Changes</span>
            <ExplainLink
              label="Unapproved Changes"
              metricKey="unapproved_changes"
              displayValue={String(unapprovedChanges)}
              showCalculationDetails={showCalculationDetails}
              onOpen={() => setExplainMetric({ key: "unapproved_changes", value: String(unapprovedChanges) })}
            />
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-[var(--text)]">{complianceRate}%</strong>{" "}
            <span className="text-[var(--text-muted)]">Governance Compliance</span>
            <ExplainLink
              label="Governance Coverage"
              metricKey="governance_coverage"
              displayValue={`${complianceRate}%`}
              showCalculationDetails={showCalculationDetails}
              onOpen={() => setExplainMetric({ key: "governance_coverage", value: `${complianceRate}%` })}
            />
          </span>
        </div>
      </CardBody>
    </Card>

      {explainMetric && (
        <MetricExplanationModal
          open={!!explainMetric}
          onOpenChange={(o) => !o && setExplainMetric(null)}
          metricKey={explainMetric.key}
          displayValue={explainMetric.value}
          showCalculationDetails={showCalculationDetails}
        />
      )}
    </>
  );
}
