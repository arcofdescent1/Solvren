/**
 * Phase 5 — Load org privacy settings for enforcement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePrivacyMode, type PrivacyMode } from "./privacy-policy";

export type OrgPrivacySettings = {
  privacyMode: PrivacyMode;
  writeBackEnabled: boolean;
  privacyPolicyVersion: string;
  expandedFinancialDetailEnabled: boolean;
};

export async function getOrgPrivacySettings(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgPrivacySettings | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("privacy_mode, write_back_enabled, privacy_policy_version, expanded_financial_detail_enabled")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    privacy_mode?: string;
    write_back_enabled?: boolean;
    privacy_policy_version?: string;
    expanded_financial_detail_enabled?: boolean;
  };

  return {
    privacyMode: parsePrivacyMode(row.privacy_mode),
    writeBackEnabled: Boolean(row.write_back_enabled),
    privacyPolicyVersion: String(row.privacy_policy_version ?? "p5-v1"),
    expandedFinancialDetailEnabled: Boolean(row.expanded_financial_detail_enabled),
  };
}
