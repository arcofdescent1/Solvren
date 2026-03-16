/**
 * GitHub App authentication: JWT generation and installation access tokens.
 * Uses RS256 JWT signed with the app private key, no external JWT package.
 */

import * as crypto from "node:crypto";
import { env } from "@/lib/env";

const JWT_EXPIRY_SEC = 60; // GitHub recommends max 10 min; 60s is enough
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // Refresh when < 60s left

type CachedToken = { token: string; expiresAt: number };

const tokenCache = new Map<number, CachedToken>();

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * Creates a short-lived JWT for GitHub App authentication (RS256).
 */
export function generateAppJwt(): string {
  const appId = env.githubAppId;
  const privateKeyB64 = env.githubPrivateKeyBase64;
  if (!appId || !privateKeyB64) {
    throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY_BASE64 are required");
  }

  const privateKeyPem = Buffer.from(privateKeyB64, "base64").toString("utf-8");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now,
    exp: now + JWT_EXPIRY_SEC,
    iss: appId,
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const toSign = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(toSign);
  const sig = sign.sign(privateKeyPem);
  const sigB64 = base64UrlEncode(sig);

  return `${toSign}.${sigB64}`;
}

/**
 * Fetches an installation access token for the given installation ID.
 * Caches tokens and refreshes when near expiry.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  const now = Date.now();
  if (cached && cached.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return cached.token;
  }

  const jwt = generateAppJwt();
  const baseUrl = env.githubApiBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const data = (await res.json()) as {
    token?: string;
    expires_at?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(data.message ?? `GitHub installation token failed: ${res.status}`);
  }

  const token = data.token;
  if (!token) {
    throw new Error("GitHub returned no installation token");
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : now + 60 * 60 * 1000;
  tokenCache.set(installationId, { token, expiresAt });

  return token;
}
