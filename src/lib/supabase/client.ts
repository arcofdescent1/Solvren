import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Stub when env is missing so we never call real SDK (avoids MIDDLEWARE_INVOCATION_FAILED on Vercel Edge). */
function createStubClient(): SupabaseClient {
  const empty = { data: { user: null }, error: null };
  const emptyData = { data: [], error: null };
  const chain = () => ({ then: (r: (v: { data: unknown[]; error: null }) => void) => r(emptyData), catch: () => chain });
  return {
    auth: {
      getUser: () => Promise.resolve(empty),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve(empty),
      signInWithOtp: () => Promise.resolve(empty),
      signInWithOAuth: () => Promise.resolve(empty),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({ select: () => chain(), insert: () => chain(), update: () => chain(), delete: () => chain(), eq: () => chain(), single: () => chain() }),
  } as unknown as SupabaseClient;
}

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    return createStubClient();
  }
  return createBrowserClient(url, key);
}
