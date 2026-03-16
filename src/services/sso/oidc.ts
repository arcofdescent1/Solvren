/**
 * OIDC helpers: discovery, token exchange, ID token validation
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type OidcEndpoints = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri: string;
  issuer: string;
};

export async function fetchOidcDiscovery(issuer: string): Promise<OidcEndpoints> {
  const issuerClean = issuer.replace(/\/$/, "");
  const discoveryUrl = `${issuerClean}/.well-known/openid-configuration`;
  const res = await fetch(discoveryUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as Record<string, unknown>;
  return {
    authorizationEndpoint: String(doc.authorization_endpoint ?? ""),
    tokenEndpoint: String(doc.token_endpoint ?? ""),
    userinfoEndpoint: doc.userinfo_endpoint ? String(doc.userinfo_endpoint) : undefined,
    jwksUri: String(doc.jwks_uri ?? ""),
    issuer: String(doc.issuer ?? issuerClean),
  };
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  tokenEndpoint: string
): Promise<{ accessToken: string; idToken: string; refreshToken?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const accessToken = String(json.access_token ?? "");
  const idToken = String(json.id_token ?? "");
  if (!idToken) throw new Error("No ID token in response");
  return {
    accessToken,
    idToken,
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
  };
}

export type ValidateIdTokenOpts = {
  idToken: string;
  issuer: string;
  clientId: string;
  jwksUri: string;
  nonce: string;
  clockSkewSeconds?: number;
};

export async function validateIdToken(opts: ValidateIdTokenOpts): Promise<JWTPayload & { sub: string }> {
  const { idToken, issuer, clientId, jwksUri, nonce, clockSkewSeconds = 120 } = opts;
  const issuerClean = issuer.replace(/\/$/, "");
  const JWKS = createRemoteJWKSet(new URL(jwksUri));
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: issuerClean,
    audience: clientId,
    clockTolerance: clockSkewSeconds,
  });
  const nonceClaim = (payload as Record<string, unknown>).nonce;
  if (nonce && nonceClaim !== nonce) {
    throw new Error("Nonce mismatch");
  }
  return payload as JWTPayload & { sub: string };
}

export function buildAuthorizeUrl(
  authorizationEndpoint: string,
  clientId: string,
  redirectUri: string,
  state: string,
  nonce: string,
  scopes: string,
  loginHint?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
    nonce,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${authorizationEndpoint}?${params.toString()}`;
}

export function getJwksUriFromIssuer(issuer: string): string {
  const clean = issuer.replace(/\/$/, "");
  return `${clean}/.well-known/jwks.json`;
}
