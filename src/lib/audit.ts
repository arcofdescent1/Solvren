import { SupabaseClient } from "@supabase/supabase-js";

export async function auditLog(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    changeEventId?: string | null;
    actorId?: string | null;
    actorType?: "USER" | "SYSTEM";
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    /** Phase 6 — structured audit (D2): snapshot before mutation */
    before?: Record<string, unknown> | null;
    /** Phase 6 — structured audit (D2): snapshot after mutation */
    after?: Record<string, unknown> | null;
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
  } = params;

  // Convenience: if the entity is the change itself, treat entityId as the change_event_id.
  const inferredChangeId =
    changeEventId ??
    ((entityType === "change" || entityType === "change_event") && entityId
      ? String(entityId)
      : null);
  const mergedMetadata: Record<string, unknown> = {
    ...metadata,
    ...(before != null ? { before } : {}),
    ...(after != null ? { after } : {}),
  };

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
    // eslint-disable-next-line no-console
    console.warn("audit_log insert failed:", error.message);
  }
}
