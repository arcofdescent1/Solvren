/**
 * HubSpot Change Processor — Phase 6.
 * Processes HubSpot webhook events (deal.propertyChange, etc.) and maps to governance workflows.
 * Integrates with hubspot_detection_events and triggers approval workflows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type HubSpotChangeEvent = {
  provider: "hubspot";
  object: string;
  objectId: string;
  property?: string;
  oldValue?: unknown;
  newValue?: unknown;
  riskType?: "pricing_change" | "discount_override" | "revenue_timing" | "revenue_commitment" | string;
};

export async function processHubSpotChange(
  _supabase: SupabaseClient,
  _orgId: string,
  _event: HubSpotChangeEvent
): Promise<void> {
  // Stub: evaluate property risk mappings, create change_event if threshold exceeded, trigger approval
  await Promise.resolve();
}
