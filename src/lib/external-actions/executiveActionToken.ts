import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const DEFAULT_TTL_HOURS = 72;

export function hashExternalExecutiveToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${rawToken}`, "utf8").digest("hex");
}

export async function createExecutiveExternalActionToken(
  admin: SupabaseClient,
  args: { orgId: string; userId: string; changeEventId: string; ttlHours?: number }
): Promise<{ id: string; rawToken: string } | null> {
  const secret = env.externalActionTokenSecret;
  if (!secret) return null;

  const rawToken = randomBytes(32).toString("base64url");
  const token_hash = hashExternalExecutiveToken(rawToken, secret);
  const expires_at = new Date(
    Date.now() + (args.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from("external_action_tokens")
    .insert({
      org_id: args.orgId,
      user_id: args.userId,
      change_event_id: args.changeEventId,
      token_hash,
      expires_at,
      metadata: {},
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id as string, rawToken };
}

export type ResolvedExecutiveToken =
  | {
      ok: true;
      id: string;
      orgId: string;
      userId: string;
      changeEventId: string;
    }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function resolveExecutiveExternalToken(
  admin: SupabaseClient,
  rawToken: string
): Promise<ResolvedExecutiveToken> {
  const secret = env.externalActionTokenSecret;
  if (!secret) return { ok: false, reason: "invalid" };

  const token_hash = hashExternalExecutiveToken(rawToken.trim(), secret);
  const { data, error } = await admin
    .from("external_action_tokens")
    .select("id, org_id, user_id, change_event_id, expires_at, used_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "invalid" };

  const usedAt = (data as { used_at?: string | null }).used_at;
  if (usedAt) return { ok: false, reason: "used" };

  const exp = (data as { expires_at?: string }).expires_at;
  if (exp && Date.parse(exp) < Date.now()) return { ok: false, reason: "expired" };

  return {
    ok: true,
    id: data.id as string,
    orgId: data.org_id as string,
    userId: data.user_id as string,
    changeEventId: data.change_event_id as string,
  };
}

export async function markExecutiveExternalTokenUsed(
  admin: SupabaseClient,
  tokenId: string
): Promise<void> {
  await admin
    .from("external_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);
}
