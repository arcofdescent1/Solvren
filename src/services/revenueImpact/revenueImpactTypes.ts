export type RevenueRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CustomerImpactLevel = "NONE" | "LOW" | "MODERATE" | "HIGH";
export type ExposureBand = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
export type IntegrationComplexity = "LOW" | "MEDIUM" | "HIGH";
export type ImpactArea =
  | "PRICING"
  | "BILLING"
  | "CONTRACTS"
  | "REVREC"
  | "REPORTING"
  | "LEAD_ROUTING";
export type FailureSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FailureLikelihood = "LOW" | "MEDIUM" | "HIGH";
export type SignalStrength = "LOW" | "MEDIUM" | "HIGH";

export type RevenueImpactReport = {
  summary: {
    businessSummary: string;
    technicalSummary: string;
  };
  risk: {
    riskLevel: RevenueRiskLevel;
    riskScore: number;
    confidenceScore: number;
  };
  impact: {
    revenueImpactAreas: ImpactArea[];
    customerImpactLevel: CustomerImpactLevel;
    estimatedExposureBand: ExposureBand;
    reportingImpact: boolean;
    operationalImpact: boolean;
  };
  systems: {
    primarySystems: string[];
    secondarySystems: string[];
    integrationComplexity: IntegrationComplexity;
  };
  failureModes: Array<{
    title: string;
    description: string;
    severity: FailureSeverity;
    likelihood: FailureLikelihood;
    signals: string[];
  }>;
  historicalSignals: Array<{
    signalKey: string;
    description: string;
    strength: SignalStrength;
  }>;
  requiredSafeguards: Array<{
    code: string;
    title: string;
    reason: string;
  }>;
  recommendedSafeguards: Array<{
    code: string;
    title: string;
    reason: string;
  }>;
  requiredApprovals: Array<{
    role: string;
    reason: string;
  }>;
  executiveSummary: {
    whyThisMatters: string;
    worstReasonableOutcome: string;
    whatReducesRiskMost: string;
  };
};

export type BaselineSignal = {
  code: string;
  points: number;
  detail?: string;
};

export type BaselineRisk = {
  baselineRiskScore: number;
  baselineRiskLevel: RevenueRiskLevel;
  signals: BaselineSignal[];
};

export type HistoricalRiskSignals = {
  similarChangeCount: number;
  incidentCount: number;
  incidentRate: number;
  topSignals: Array<{
    signalKey: string;
    description: string;
    strength: SignalStrength;
  }>;
};

export type RevenueImpactInput = {
  inputHash: string;
  change: {
    id: string;
    orgId: string;
    title: string | null;
    description: string | null;
    changeType: string | null;
    domain: string | null;
    systems: string[];
    rolloutMethod: string | null;
    rollbackPlan: string | null;
    monitoringPlan: string | null;
    customerImpact: boolean | null;
    revenueImpactArea: string[];
    revenueExposureEstimate: number | null;
    backfillRequired: boolean | null;
    approvers: string[];
    evidenceItems: Array<{ label: string; kind: string; status: string }>;
    authorId: string | null;
    status: string | null;
    createdAt: string | null;
    submittedAt: string | null;
    customerSegments?: string[] | null;
    deploymentWindow?: string | null;
    dataBackfillDescription?: string | null;
    linkedSystems?: string[] | null;
    implementationNotes?: string | null;
    communicationPlan?: string | null;
    expectedBusinessOutcome?: string | null;
  };
  organization: {
    orgName: string | null;
    orgSettings: Record<string, unknown>;
    approvalMappings: Array<{ roleLabel: string; approvalArea: string; domainKey: string | null }>;
    domainSettings: Record<string, unknown>;
    systemCatalog: string[];
  };
  historical: HistoricalRiskSignals;
};

export type SavedRevenueImpactReport = {
  id: string;
  org_id: string;
  change_id: string;
  version: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  generated_by: "RULES_ONLY" | "HYBRID_AI" | "MANUAL";
  model_name: string | null;
  prompt_version: string | null;
  input_hash: string;
  report_json: RevenueImpactReport;
  baseline_json: BaselineRisk;
  summary_text: string | null;
  risk_score: number | null;
  risk_level: RevenueRiskLevel | null;
  confidence_score: number | null;
  is_current: boolean;
  created_by_user_id: string | null;
  created_at: string;
  superseded_at: string | null;
};
