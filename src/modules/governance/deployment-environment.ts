/**
 * Phase 5 — Map deployment/runtime to governance environment contract (dev | staging | prod).
 */
import type { GovernanceEnvironment } from "./types/governance-context";

export function deploymentGovernanceEnvironment(): GovernanceEnvironment {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production") return "prod";
  if (vercel === "preview" || vercel === "development") return "staging";
  if (process.env.NODE_ENV === "production") return "prod";
  return "dev";
}
