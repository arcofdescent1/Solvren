/**
 * Phase 1 — Health-to-status resolver (§21.1).
 * Derives top-level IntegrationAccountStatus from health dimensions and flags.
 */
import type { IntegrationAccountStatus } from "../contracts/types";

export type HealthEvaluatorInput = {
  status: string;
  disconnectedAt: string | null;
  authExpired: boolean;
  installComplete: boolean;
  criticalError: boolean;
  syncRunning: boolean;
  actionConfigValid: boolean;
  requiredScopesMissing: boolean;
  webhookOrConfigIncomplete: boolean;
  freshnessOrHealthFailing: boolean;
};

/**
 * Deterministic precedence (§21.1):
 * 1. disconnected → disconnected
 * 2. auth invalid → auth_expired
 * 3. install incomplete → installing
 * 4. critical error → error
 * 5. sync running → syncing
 * 6. read ok but action config invalid → action_limited
 * 7. required scopes missing or webhook/config incomplete → connected_limited
 * 8. freshness or health failing → degraded
 * 9. else → connected
 */
export function deriveIntegrationStatus(input: HealthEvaluatorInput): IntegrationAccountStatus {
  if (input.disconnectedAt != null) return "disconnected";
  if (input.authExpired) return "auth_expired";
  if (!input.installComplete) return "installing";
  if (input.criticalError) return "error";
  if (input.syncRunning) return "syncing";
  if (input.actionConfigValid === false && input.installComplete) return "action_limited";
  if (input.requiredScopesMissing || input.webhookOrConfigIncomplete) return "connected_limited";
  if (input.freshnessOrHealthFailing) return "degraded";
  return "connected";
}
