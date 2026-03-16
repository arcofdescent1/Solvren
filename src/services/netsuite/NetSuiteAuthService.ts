/**
 * NetSuite OAuth 2.0 Client Credentials token flow.
 */

import { env } from "@/lib/env";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
type CachedToken = { accessToken: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

function getTokenUrl(accountId: string): string {
  return env.netsuiteTokenUrlTemplate.replace("{accountId}", accountId);
}

export async function getAccessToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const key = `${accountId}:${clientId}`;
  const cached = tokenCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > now) return cached.accessToken;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(getTokenUrl(accountId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Token failed: ${res.status}`);
  const token = data.access_token;
  if (!token) throw new Error("No access_token");
  const expiresAt = now + (data.expires_in ?? 3600) * 1000;
  tokenCache.set(key, { accessToken: token, expiresAt });
  return token;
}
