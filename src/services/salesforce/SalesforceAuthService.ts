/** Salesforce OAuth 2.0: JWT Bearer and Client Credentials flows. IES §6, §19 */

import * as jose from "jose";
import { env } from "@/lib/env";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
type CachedToken = { accessToken: string; instanceUrl: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

function getTokenUrl(envType: "production" | "sandbox"): string {
  const base = envType === "sandbox" ? env.salesforceTestLoginUrl : env.salesforceLoginUrl;
  return `${base}/services/oauth2/token`;
}

export type TokenResult = { accessToken: string; instanceUrl: string; idUrl?: string };

export async function getAccessTokenClientCredentials(
  envType: "production" | "sandbox",
  clientId: string,
  clientSecret: string
): Promise<TokenResult> {
  const key = `cc:${envType}:${clientId}`;
  const cached = tokenCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > now) {
    return { accessToken: cached.accessToken, instanceUrl: cached.instanceUrl };
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(getTokenUrl(envType), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    instance_url?: string;
    id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Token failed: ${res.status}`);
  const token = data.access_token;
  const instanceUrl = data.instance_url;
  if (!token || !instanceUrl) throw new Error("Missing access_token or instance_url");

  const expiresAt = now + (data.expires_in ?? 3600) * 1000;
  const idUrl = data.id;
  tokenCache.set(key, { accessToken: token, instanceUrl, expiresAt });
  return { accessToken: token, instanceUrl, idUrl };
}

export async function getAccessTokenJwt(
  envType: "production" | "sandbox",
  clientId: string,
  username: string,
  privateKeyBase64: string
): Promise<TokenResult> {
  const key = `jwt:${envType}:${clientId}:${username}`;
  const cached = tokenCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > now) {
    return { accessToken: cached.accessToken, instanceUrl: cached.instanceUrl };
  }

  const audience = envType === "sandbox" ? env.salesforceTestLoginUrl : env.salesforceLoginUrl;
  const keyPem = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
  const pk = await jose.importPKCS8(keyPem, "RS256");

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientId)
    .setSubject(username)
    .setAudience(audience)
    .setExpirationTime("3m")
    .sign(pk);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const res = await fetch(getTokenUrl(envType), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const dataJwt = (await res.json()) as {
    access_token?: string;
    instance_url?: string;
    id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) throw new Error(dataJwt.error_description ?? dataJwt.error ?? `JWT token failed: ${res.status}`);
  const token = dataJwt.access_token;
  const instanceUrl = dataJwt.instance_url;
  if (!token || !instanceUrl) throw new Error("Missing access_token or instance_url");

  const expiresAt = now + (dataJwt.expires_in ?? 3600) * 1000;
  const idUrl = dataJwt.id;
  tokenCache.set(key, { accessToken: token, instanceUrl, expiresAt });
  return { accessToken: token, instanceUrl, idUrl };
}

/** OAuth web-server refresh_token grant (Phase 1 value engine). */
export async function refreshAccessTokenWithRefreshToken(params: {
  environment: "production" | "sandbox";
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResult & { refresh_token?: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(getTokenUrl(params.environment), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    instance_url?: string;
    refresh_token?: string;
    id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `Refresh failed: ${res.status}`);
  const token = data.access_token;
  const instanceUrl = data.instance_url;
  if (!token || !instanceUrl) throw new Error("Missing access_token or instance_url from refresh");
  return {
    accessToken: token,
    instanceUrl,
    idUrl: data.id,
    refresh_token: data.refresh_token,
  };
}
