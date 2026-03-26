export type RoiConfidence =
  | "estimated"
  | "observed"
  | "likely_prevented"
  | "confirmed_resolved";

export type RoiTrendState = "improving" | "stable" | "needs_attention";

export type RoiMetric = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  confidence: RoiConfidence;
  valueStatement: string;
  howDetermined: string;
};

export type RoiStoryCard = {
  id: string;
  title: string;
  summary: string;
  confidence: RoiConfidence;
  whyThisCounts: string;
  happenedAt: string;
  href: string;
  entityType: "issue" | "change";
  entityId: string;
};

export type RoiSummaryResponse = {
  ok: boolean;
  range: "7d" | "30d" | "90d";
  rangeDays: number;
  asOf: string;
  confidenceModel: RoiConfidence[];
  impactSummary: {
    preventedLikelyCount: number;
    resolvedCount: number;
    governedCount: number;
    reviewedHighRiskPercent: number;
    trend: RoiTrendState;
    estimatedExposure: number;
  };
  trendImprovement: {
    exposureDirection: "increasing" | "decreasing" | "stable";
    exposureDeltaPct: number;
    overdueDelta: number;
    highRiskDelta: number;
  };
  kpis: {
    overdueReduction: RoiMetric;
    approvalLatencyTrend: RoiMetric;
    issueResolutionTrend: RoiMetric;
  };
  metrics: {
    prevented: RoiMetric;
    resolved: RoiMetric;
    governed: RoiMetric;
    trend: RoiMetric;
  };
  stories: RoiStoryCard[];
  previousWindow: {
    start: string;
    end: string;
  };
  currentWindow: {
    start: string;
    end: string;
  };
};
