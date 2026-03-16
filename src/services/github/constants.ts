/**
 * GitHub IES default file path rules.
 * Maps path patterns to domain and riskWeight.
 */

import type { FilePathRule } from "./types";

/** Default file path rules from the IES. */
export const DEFAULT_FILE_PATH_RULES: FilePathRule[] = [
  { pattern: "pricing/**", domain: "revenue", riskWeight: 90 },
  { pattern: "billing/**", domain: "revenue", riskWeight: 90 },
  { pattern: "subscriptions/**", domain: "revenue", riskWeight: 85 },
  { pattern: "invoice/**", domain: "revenue", riskWeight: 85 },
  { pattern: "revrec/**", domain: "revenue", riskWeight: 95 },
  { pattern: "**/revrec/**", domain: "revenue", riskWeight: 95 },
  { pattern: "salesforce/routing/**", domain: "revenue", riskWeight: 80 },
  { pattern: "hubspot/workflows/**", domain: "revenue", riskWeight: 75 },
];
