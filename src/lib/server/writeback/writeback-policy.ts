/**
 * Phase 5 — External system mutations require explicit org opt-in.
 */
import { createPrivilegedClient } from "@/lib/server/adminClient";

export class WriteBackNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteBackNotAllowedError";
  }
}

async function insertAudit(
  orgId: string,
  provider: string,
  actionType: string,
  actorUserId: string | null,
  status: "allowed" | "denied",
  reason: string | null,
): Promise<void> {
  const admin = createPrivilegedClient("write_back_audit: record");
  const { error } = await admin.from("write_back_audit").insert({
    org_id: orgId,
    provider,
    action_type: actionType,
    actor_user_id: actorUserId,
    status,
    reason,
  });
  if (error) {
    console.error("[write_back_audit]", error.message);
  }
}

export async function requireWriteBackAllowed(input: {
  orgId: string;
  provider: string;
  actionType: string;
  actorUserId: string | null;
}): Promise<void> {
  const { orgId, provider, actionType, actorUserId } = input;

  const admin = createPrivilegedClient("write_back_policy: read org flag");
  const { data, error } = await admin.from("organizations").select("write_back_enabled").eq("id", orgId).maybeSingle();

  if (error || !data) {
    await insertAudit(orgId, provider, actionType, actorUserId, "denied", "org_not_found");
    throw new WriteBackNotAllowedError("Organization not found");
  }

  if (!Boolean((data as { write_back_enabled?: boolean }).write_back_enabled)) {
    await insertAudit(orgId, provider, actionType, actorUserId, "denied", "write_back_disabled");
    throw new WriteBackNotAllowedError("Write-back is disabled for this organization");
  }

  await insertAudit(orgId, provider, actionType, actorUserId, "allowed", null);
}
