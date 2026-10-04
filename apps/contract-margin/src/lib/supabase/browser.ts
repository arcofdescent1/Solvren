"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function browserSupabase() {
  if (!client) {
    const { url, key } = publicSupabaseConfig();
    client = createBrowserClient(url, key);
  }
  return client;
}
