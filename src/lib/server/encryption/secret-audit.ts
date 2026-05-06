/**
 * Phase 3 — Secret access audit (service role; bypasses RLS).
 */
import { createClient } from "@supabase/supabase-js";
import type { ActorType, SecretAccessReason } from "./secret-types";

function auditClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("secret audit: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function auditSecretAccess(input: {
  orgId: string;
  integrationAccountId?: string | null;
  secretField: string;
  actor: ActorType;
  actorId?: string | null;
  reason: SecretAccessReason;
  accessContext?: string | null;
}): Promise<void> {
  if (input.actor !== "system" && !input.actorId) {
    throw new Error("secret audit: actor_id required for user and employee");
  }
  const client = auditClient();
  const { error } = await client.from("secret_access_audit").insert({
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId ?? null,
    secret_field: input.secretField,
    actor_type: input.actor,
    actor_id: input.actorId ?? null,
    reason: input.reason,
    access_context: input.accessContext ?? null,
  });
  if (error) {
    console.error("secret audit insert failed", error.message);
  }
}

/** Fire-and-forget audit (sync reveal paths). */
export function auditSecretAccessFireAndForget(input: Parameters<typeof auditSecretAccess>[0]): void {
  void auditSecretAccess(input).catch(() => {
    /* logged in auditSecretAccess */
  });
}
