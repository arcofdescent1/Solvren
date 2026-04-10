/**
 * Phase 0 — privileged Supabase client (service role). Bypasses RLS.
 * Every call site must pass a human-readable reason for review and logging.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function assertServerOnly(context: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`createPrivilegedClient is server-only (${context})`);
  }
}

/**
 * Service-role client. Use only after auth + org checks on user-triggered routes,
 * or in cron/webhooks/workers where no end-user session exists.
 */
export function createPrivilegedClient(reason: string): SupabaseClient {
  assertServerOnly(reason);
  if (!reason || reason.trim().length < 3) {
    throw new Error("createPrivilegedClient: reason must be a non-empty description");
  }
  if (process.env.NODE_ENV === "development") {
     
    console.info("[privileged:service-role]", reason);
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
