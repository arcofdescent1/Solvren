/** HubSpot OAuth refresh and private-app handling. IES §6, §12 */

import { env } from "@/lib/env";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.hubspotClientId!,
    client_secret: env.hubspotClientSecret!,
    refresh_token: refreshToken,
  });
  const res = await fetch(env.hubspotOAuthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Token refresh failed: ${res.status}`);
  const token = data.access_token;
  if (!token) throw new Error("No access_token");
  return { accessToken: token };
}

export function needsRefresh(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return true;
  const ts = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Date.now() >= ts - REFRESH_BUFFER_MS;
}
