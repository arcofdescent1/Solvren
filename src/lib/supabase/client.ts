import { createBrowserClient } from "@supabase/ssr";

declare global {
  interface Window {
    __SUPABASE_ENV__?: { url: string; key: string };
  }
}

function getSupabaseEnv() {
  if (typeof window !== "undefined" && window.__SUPABASE_ENV__?.url && window.__SUPABASE_ENV__?.key) {
    return { url: window.__SUPABASE_ENV__.url, key: window.__SUPABASE_ENV__.key };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url: url ?? "", key: key ?? "" };
}

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error(
      "Supabase URL and anon key are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables, then redeploy."
    );
  }
  return createBrowserClient(url, key);
}
