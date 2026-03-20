/**
 * Phase 9 — Environment ceilings (§14).
 */
import { ExecutionMode } from "./execution-mode";

export type AppEnvironment = "production" | "staging" | "sandbox" | "demo" | "internal";

export const ENVIRONMENT_CEILINGS: Record<AppEnvironment, ExecutionMode> = {
  demo: ExecutionMode.SUGGEST_ONLY,
  sandbox: ExecutionMode.APPROVAL_REQUIRED,
  staging: ExecutionMode.BOUNDED_AUTO,
  production: ExecutionMode.FULL_AUTO,
  internal: ExecutionMode.FULL_AUTO,
};

export function getEnvironmentCeiling(env: AppEnvironment): ExecutionMode {
  return ENVIRONMENT_CEILINGS[env] ?? ExecutionMode.APPROVAL_REQUIRED;
}
