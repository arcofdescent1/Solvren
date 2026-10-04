import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseConfig } from "@/lib/env";

export async function serverSupabase() {
  const store = await cookies();
  const { url, key } = publicSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(items) {
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Cookie refresh is completed by the Next.js proxy. */ }
      },
    },
  });
}
