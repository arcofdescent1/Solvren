/**
 * Shared OAuth state signing/verification for integration OAuth flows.
 * Used by Jira, HubSpot, and other OAuth-based integrations.
 */

import crypto from "crypto";
import { env } from "@/lib/env";

export type OAuthStatePayload = { orgId: string; userId: string; iat: number; returnTo?: string };

const STATE_TTL_MS = 10 * 60 * 1000;

function getSecret(provider: "jira" | "hubspot"): string {
  if (provider === "jira") {
    const s = env.jiraStateSecret;
    if (!s) throw new Error("Missing JIRA_STATE_SECRET (or ATLASSIAN_STATE_SECRET or SLACK_STATE_SECRET)");
    return s;
  }
  if (provider === "hubspot") {
    const s = env.hubspotStateSecret;
    if (!s) throw new Error("Missing HUBSPOT_STATE_SECRET (or SLACK_STATE_SECRET)");
    return s;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

export function signOAuthState(
  provider: "jira" | "hubspot",
  input: { orgId: string; userId: string; returnTo?: string }
): string {
  const payload: OAuthStatePayload = { ...input, iat: Date.now() };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSecret(provider);
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}

export function verifyOAuthState(
  provider: "jira" | "hubspot",
  state: string
): OAuthStatePayload {
  const [raw, sig] = state.split(".");
  if (!raw || !sig) throw new Error("invalid_state_format");

  const secret = getSecret(provider);
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("invalid_state_signature");
  }

  const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthStatePayload;
  if (Date.now() - payload.iat > STATE_TTL_MS) throw new Error("state_expired");
  return payload;
}
