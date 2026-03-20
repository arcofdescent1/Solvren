/**
 * Phase 4 — Detector health model (§14).
 */
export type DetectorHealthStatus = "healthy" | "degraded" | "limited_coverage" | "not_enough_data" | "misconfigured";

export type DetectorHealthSnapshot = {
  coverage_score: number;
  signal_availability_score: number;
  signal_freshness_score: number;
  noise_score: number;
  precision_proxy_score?: number;
  blind_spots: string[];
  status: DetectorHealthStatus;
};
