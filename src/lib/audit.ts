import { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction } from "@/lib/audit/actions";
import { AuditLogRequiredError } from "@/lib/audit/actions";

const SENSITIVE_METADATA_KEYS =
  /^(password|token|secret|authorization|cookie|api[_-]?key|service[_-]?role|private[_-]?key)$/i;

/** Strip common secret-bearing keys from metadata (best effort). */
export function sanitizeAuditMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_METADATA_KEYS.test(k)) continue;
    if (typeof v === "string" && v.length > 2000) {
      out[k] = `${v.slice(0, 2000)}…[truncated]`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function auditLog(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    changeEventId?: string | null;
    actorId?: string | null;
    actorType?: "USER" | "SYSTEM";
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    /** Phase 6 — structured audit (D2): snapshot before mutation */
    before?: Record<string, unknown> | null;
    /** Phase 6 — structured audit (D2): snapshot after mutation */
    after?: Record<string, unknown> | null;
    /** If true, insert failure throws AuditLogRequiredError (fail closed). */
    required?: boolean;
  }
) {
  const {
    orgId,
    changeEventId = null,
    actorId = null,
    actorType = "USER",
    action,
    entityType,
    entityId = null,
    metadata = {},
    before = null,
    after = null,
    required = false,
  } = params;

  // Convenience: if the entity is the change itself, treat entityId as the change_event_id.
  const inferredChangeId =
    changeEventId ??
    ((entityType === "change" || entityType === "change_event") && entityId
      ? String(entityId)
      : null);
  const mergedMetadata: Record<string, unknown> = sanitizeAuditMetadata({
    ...metadata,
    ...(before != null ? { before } : {}),
    ...(after != null ? { after } : {}),
  });

  const { error } = await supabase.from("audit_log").insert({
    org_id: orgId,
    change_event_id: inferredChangeId,
    actor_id: actorId,
    actor_type: actorType,
    action,
    entity_type: entityType,
    entity_id: entityId != null ? String(entityId) : null,
    metadata: mergedMetadata,
  });

  if (error) {
    if (required) {
      throw new AuditLogRequiredError(error.message);
    }
     
    console.warn("audit_log insert failed:", error.message);
  }
}

export { AuditLogRequiredError } from "@/lib/audit/actions";

export type AuditLogInsertResult = { ok: true } | { ok: false; message: string };

/**
 * Membership / highly sensitive ops: fail closed if audit cannot be written.
 */
export async function auditLogStrict(
  supabase: SupabaseClient,
  params: Parameters<typeof auditLog>[1]
): Promise<AuditLogInsertResult> {
  const {
    orgId,
    changeEventId = null,
    actorId = null,
    actorType = "USER",
    action,
    entityType,
    entityId = null,
    metadata = {},
    before = null,
    after = null,
  } = params;

  const inferredChangeId =
    changeEventId ??
    ((entityType === "change" || entityType === "change_event") && entityId
      ? String(entityId)
      : null);
  const mergedMetadata: Record<string, unknown> = sanitizeAuditMetadata({
    ...metadata,
    ...(before != null ? { before } : {}),
    ...(after != null ? { after } : {}),
  });

  const { error } = await supabase.from("audit_log").insert({
    org_id: orgId,
    change_event_id: inferredChangeId,
    actor_id: actorId,
    actor_type: actorType,
    action,
    entity_type: entityType,
    entity_id: entityId != null ? String(entityId) : null,
    metadata: mergedMetadata,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
