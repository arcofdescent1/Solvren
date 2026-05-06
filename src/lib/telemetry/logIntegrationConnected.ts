import type { SupabaseClient } from "@supabase/supabase-js";
import { logProductEventAsync } from "./productEvents";

/** Emits `integration_connected` (canonical PRODUCT_EVENTS). */
export function logIntegrationConnected(
  db: SupabaseClient,
  input: { orgId: string; userId: string | null; provider: string; metadata?: Record<string, unknown> }
): void {
  logProductEventAsync(db, {
    event: "integration_connected",
    orgId: input.orgId,
    userId: input.userId,
    entityType: "integration",
    metadata: { provider: input.provider, ...input.metadata },
  });
}
