/**
 * Phase 8 — Demo safety service.
 * Guardrails: never reset/seed non-demo orgs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgDemoConfig } from "../repositories/org-demo-config.repository";

export async function assertDemoOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: config, error } = await getOrgDemoConfig(supabase, orgId);
  if (error) return { ok: false, error: "Failed to load org config" };
  if (!config) return { ok: false, error: "Org config not found" };
  if (!config.isDemoOrg) return { ok: false, error: "Org is not a demo org. Demo operations are not allowed." };
  return { ok: true };
}

export function isDemoOperationBlocked(orgId: string | null, isDemoOrg: boolean): boolean {
  if (!orgId) return true;
  return !isDemoOrg;
}
