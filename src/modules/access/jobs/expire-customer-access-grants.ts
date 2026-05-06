/**
 * Phase 4 — expire approved grants and end expired break-glass events (service role; idempotent).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function expireCustomerAccessGrants(admin: SupabaseClient): Promise<{
  grantsExpired: number;
  breakGlassEnded: number;
}> {
  const now = new Date().toISOString();

  const { data: staleGrants, error: gErr } = await admin
    .from("customer_access_grants")
    .select("id")
    .eq("status", "approved")
    .lt("expires_at", now);

  if (gErr) {
    console.error("[expireCustomerAccessGrants] grants select", gErr.message);
    return { grantsExpired: 0, breakGlassEnded: 0 };
  }

  const grantIds = (staleGrants ?? []).map((r) => (r as { id: string }).id);
  if (grantIds.length > 0) {
    const { error: uErr } = await admin.from("customer_access_grants").update({ status: "expired" }).in("id", grantIds);
    if (uErr) console.error("[expireCustomerAccessGrants] grants update", uErr.message);
  }

  const { data: staleBg, error: bErr } = await admin
    .from("break_glass_access_events")
    .select("id")
    .is("ended_at", null)
    .not("activated_at", "is", null)
    .lt("expires_at", now);

  if (bErr) {
    console.error("[expireCustomerAccessGrants] break_glass select", bErr.message);
    return { grantsExpired: grantIds.length, breakGlassEnded: 0 };
  }

  const bgIds = (staleBg ?? []).map((r) => (r as { id: string }).id);
  if (bgIds.length > 0) {
    const { error: buErr } = await admin
      .from("break_glass_access_events")
      .update({ ended_at: now, customer_notified_at: now })
      .in("id", bgIds);
    if (buErr) console.error("[expireCustomerAccessGrants] break_glass update", buErr.message);
  }

  return { grantsExpired: grantIds.length, breakGlassEnded: bgIds.length };
}
