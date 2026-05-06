/**
 * Phase 4 — employee customer-data access audit (service role insert).
 */
import { createClient } from "@supabase/supabase-js";
import type { EmployeeAccessAuditInput } from "./access-types";

function auditClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("employee access audit: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function auditEmployeeAccess(input: EmployeeAccessAuditInput): Promise<void> {
  const client = auditClient();
  const { error } = await client.from("employee_access_audit").insert({
    org_id: input.orgId,
    employee_user_id: input.employeeUserId,
    access_type: input.accessType,
    access_level: input.accessLevel,
    legal_basis: input.legalBasis,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    reason: input.reason.slice(0, 2000),
    grant_id: input.grantId ?? null,
    break_glass_event_id: input.breakGlassEventId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });
  if (error) {
    console.error("employee_access_audit insert failed", error.message);
  }
}

export function auditEmployeeAccessFireAndForget(input: EmployeeAccessAuditInput): void {
  void auditEmployeeAccess(input).catch(() => {});
}
