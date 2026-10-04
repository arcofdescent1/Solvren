import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "@/lib/env";

export function adminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(publicSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
