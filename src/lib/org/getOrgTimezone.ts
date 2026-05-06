import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 5 — canonical timezone resolution order:
 * organizations.timezone → organization_settings.timezone → digest_settings.timezone → UTC
 */
export async function getOrgTimezone(supabase: SupabaseClient, orgId: string): Promise<string> {
  const [{ data: org }, { data: settings }, { data: digest }] = await Promise.all([
    supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle(),
    supabase.from("organization_settings").select("timezone").eq("org_id", orgId).maybeSingle(),
    supabase.from("digest_settings").select("timezone").eq("org_id", orgId).maybeSingle(),
  ]);

  const a = (org as { timezone?: string | null } | null)?.timezone?.trim();
  if (a) return a;
  const b = (settings as { timezone?: string | null } | null)?.timezone?.trim();
  if (b) return b;
  const c = (digest as { timezone?: string | null } | null)?.timezone?.trim();
  if (c) return c;
  return "UTC";
}
