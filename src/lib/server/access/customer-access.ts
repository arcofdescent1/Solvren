/**
 * Phase 4 — gate employee reads of customer data + audit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEmployeeAccess } from "./employee-access-policy";
import { auditEmployeeAccessFireAndForget } from "./employee-access-audit";
import type { AccessDecision, CustomerResourceType, EmployeeDataRequestLevel } from "./access-types";
import type { EmployeeProfile } from "@/lib/server/employee/phase4EmployeeRoleMap";

export async function requireEmployeeCustomerAccess(input: {
  admin: SupabaseClient;
  employee: EmployeeProfile;
  orgId: string;
  requestedLevel: EmployeeDataRequestLevel;
  resourceType: CustomerResourceType;
  resourceId?: string | null;
  reason: string;
  requestContext?: { ipAddress?: string; userAgent?: string | null };
}): Promise<AccessDecision> {
  const reason = input.reason?.trim() ?? "";
  if (!reason) {
    throw new Error("Employee customer access requires a reason");
  }

  const decision = await resolveEmployeeAccess({
    admin: input.admin,
    employeeUserId: input.employee.userId,
    phase4Role: input.employee.role,
    orgId: input.orgId,
    requestedLevel: input.requestedLevel,
  });

  if (!decision.allowed) {
    throw new Error("Employee access denied");
  }

  auditEmployeeAccessFireAndForget({
    orgId: input.orgId,
    employeeUserId: input.employee.userId,
    accessType: decision.accessType,
    accessLevel: decision.accessLevel,
    legalBasis: decision.legalBasis,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    reason,
    grantId: decision.grantId ?? null,
    breakGlassEventId: decision.breakGlassEventId ?? null,
    ipAddress: input.requestContext?.ipAddress ?? null,
    userAgent: input.requestContext?.userAgent ?? null,
  });

  return decision;
}
