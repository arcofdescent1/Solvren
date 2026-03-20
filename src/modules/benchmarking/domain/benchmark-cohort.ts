/**
 * Phase 6 — Cohort definition (§7.2).
 */
export type CohortDefinition = {
  cohortKey: string;
  displayName: string;
  dimensions: {
    companySizeBand?: string;
    arrBand?: string;
    businessModel?: string;
    salesMotion?: string;
    industryFamily?: string;
    integrationFootprintTier?: string;
    operationalMaturityTier?: string;
  };
  minimumOrgCount: number;
  metricKeys: string[];
};
