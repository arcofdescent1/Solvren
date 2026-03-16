import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "On Vercel, add them in Project → Settings → Environment Variables, then redeploy with 'Clear cache and redeploy' so they are inlined at build time."
    );
  }
  return createBrowserClient(url, key);
}
