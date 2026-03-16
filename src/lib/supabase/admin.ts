import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service role client for background jobs (notifications processor, etc).
 * Bypasses RLS. Use only in trusted server-side code.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
}
