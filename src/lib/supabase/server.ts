import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSupabaseEnvServer(): { url: string; key: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const url = rawUrl.trim();
  const key = rawKey.trim();
  const validUrl = url.length > 0 && url !== "undefined";
  const validKey = key.length > 0 && key !== "undefined";
  return { url: validUrl ? url : "", key: validKey ? key : "" };
}

export async function createServerSupabaseClient() {
  const { url, key } = getSupabaseEnvServer();
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in the environment (e.g. Vercel Project Settings). " +
        "Redeploy after changing env vars. If the vars show as 'undefined', add them in Vercel → Project → Settings → Environment Variables for this project and environment."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Middleware will handle refresh in some contexts.
          }
        },
      },
    }
  );
}
