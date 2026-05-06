/**
 * Phase 5 — ROI estimates without raw revenue; explicit provenance.
 */
import type { PrivacyMode } from "@/lib/server/privacy/privacy-policy";

export type ROIInputSource =
  | "customer_entered_estimate"
  | "integration_derived_estimate"
  | "system_default"
  | "expanded_limited_financial_signal";

export type ROIEstimationInput = {
  failureRate: number;
  eventCount: number;
  estimatedValuePerEvent?: number;
  averageDealSize?: number;
  /** Populated in expanded mode for banded deal signals */
  limitedFinancialBandAverage?: number;
  sources: ROIInputSource[];
};

export type ROIEstimationOutput = {
  estimatedRevenueAtRisk: number;
  confidenceLevel: "low" | "medium" | "high";
  inputSources: ROIInputSource[];
  formulaVersion: string;
  disclaimer: string;
};

const DISCLAIMER =
  "Estimated impact is directional and based on operational signals, failure rates, and configured assumptions. It is not an audited financial measure.";

const FORMULA_VERSION = "roi-p5-v1";

export function estimateRevenueAtRisk(input: ROIEstimationInput, privacyMode: PrivacyMode): ROIEstimationOutput {
  const sources = [...input.sources];
  let valuePerUnit =
    input.estimatedValuePerEvent ??
    input.averageDealSize ??
    (privacyMode === "expanded" ? input.limitedFinancialBandAverage : undefined) ??
    100;

  if (input.estimatedValuePerEvent != null && !sources.includes("customer_entered_estimate")) {
    sources.push("customer_entered_estimate");
  }
  if (input.averageDealSize != null && !sources.includes("customer_entered_estimate")) {
    sources.push("customer_entered_estimate");
  }
  if (input.limitedFinancialBandAverage != null) {
    if (!sources.includes("expanded_limited_financial_signal")) {
      sources.push("expanded_limited_financial_signal");
    }
  }
  if (!sources.length) {
    sources.push("system_default");
  }

  const fr = Math.max(0, Math.min(1, input.failureRate));
  const count = Math.max(0, input.eventCount);
  const estimatedRevenueAtRisk = Math.round(fr * count * valuePerUnit);

  let confidenceLevel: ROIEstimationOutput["confidenceLevel"] = "low";
  if (sources.includes("customer_entered_estimate") || sources.includes("integration_derived_estimate")) {
    confidenceLevel = "medium";
  }
  if (sources.includes("expanded_limited_financial_signal") && privacyMode === "expanded") {
    confidenceLevel = confidenceLevel === "medium" ? "high" : "medium";
  }

  return {
    estimatedRevenueAtRisk,
    confidenceLevel,
    inputSources: [...new Set(sources)],
    formulaVersion: FORMULA_VERSION,
    disclaimer: DISCLAIMER,
  };
}
