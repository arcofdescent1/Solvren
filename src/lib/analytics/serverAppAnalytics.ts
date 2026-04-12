/**
 * Server-side product analytics: persists to `audit_log` (entity_type product_analytics)
 * for warehouse / SIEM export. Safe to call from API routes; failures are logged, not thrown.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog, sanitizeAuditMetadata } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/actions";

export async function trackServerAppEvent(
  admin: SupabaseClient,
  params: {
    orgId: string;
    userId?: string | null;
    event: string;
    properties?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await auditLog(admin, {
      orgId: params.orgId,
      actorId: params.userId ?? null,
      actorType: params.userId ? "USER" : "SYSTEM",
      action: params.event as AuditAction,
      entityType: "product_analytics",
      entityId: null,
      metadata: sanitizeAuditMetadata({
        area: "server_api",
        ...(params.properties ?? {}),
      }),
    });
  } catch (e) {
    console.warn("[trackServerAppEvent]", params.event, e);
  }
}
