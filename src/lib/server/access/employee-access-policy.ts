/**
 * Phase 4 — resolve employee access to customer data (grants + break-glass + role ceiling).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeePhase4Role } from "@/lib/server/employee/phase4EmployeeRoleMap";
import { phase4RoleMaxMaskingTier } from "@/lib/server/employee/phase4EmployeeRoleMap";
import type { AccessDecision, EmployeeDataRequestLevel } from "./access-types";

type GrantRow = {
  id: string;
  access_level: string;
  status: string;
  expires_at: string | null;
  starts_at: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function grantIsActive(g: GrantRow | null): g is GrantRow {
  if (!g || g.status !== "approved" || !g.expires_at) return false;
  const t = Date.now();
  if (new Date(g.expires_at).getTime() <= t) return false;
  const start = g.starts_at ? new Date(g.starts_at).getTime() : 0;
  if (start > t) return false;
  return true;
}

async function findActiveGrant(
  admin: SupabaseClient,
  orgId: string,
  employeeUserId: string,
): Promise<GrantRow | null> {
  const { data, error } = await admin
    .from("customer_access_grants")
    .select("id, access_level, status, expires_at, starts_at")
    .eq("org_id", orgId)
    .eq("employee_user_id", employeeUserId)
    .eq("status", "approved")
    .gt("expires_at", nowIso())
    .order("expires_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  const g = data[0] as GrantRow;
  return grantIsActive(g) ? g : null;
}

type BreakGlassRow = { id: string; expires_at: string | null; activated_at: string | null; ended_at: string | null };

/** Org-wide activated break-glass (max one active per org enforced at write time). */
async function findActiveBreakGlassForOrg(admin: SupabaseClient, orgId: string): Promise<BreakGlassRow | null> {
  const { data, error } = await admin
    .from("break_glass_access_events")
    .select("id, expires_at, activated_at, ended_at")
    .eq("org_id", orgId)
    .is("ended_at", null)
    .not("activated_at", "is", null)
    .gt("expires_at", nowIso())
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as BreakGlassRow;
}

/** Pure evaluation (unit-tested); supply active grant + org break-glass flag from DB layer. */
export function evaluateEmployeeDataAccess(
  requested: EmployeeDataRequestLevel,
  role: EmployeePhase4Role,
  grant: GrantRow | null,
  breakGlassActive: boolean,
): AccessDecision {
  const max = phase4RoleMaxMaskingTier(role);
  const gid = grant?.id;

  if (requested === "metadata") {
    return {
      allowed: true,
      dataMaskingTier: "metadata",
      legalBasis: "metadata_default",
      accessType: "metadata",
      accessLevel: "tier_0",
    };
  }

  if (requested === "masked") {
    const grantOk = grant && (grant.access_level === "masked" || grant.access_level === "sensitive");
    if (!grantOk && !breakGlassActive) {
      return {
        allowed: false,
        dataMaskingTier: "metadata",
        legalBasis: "metadata_default",
        accessType: "masked",
        accessLevel: "tier_1",
      };
    }
    if (breakGlassActive) {
      const tier: AccessDecision["dataMaskingTier"] = max === "masked" ? "masked" : "sensitive";
      return {
        allowed: true,
        dataMaskingTier: tier,
        legalBasis: "break_glass",
        accessType: "break_glass",
        accessLevel: "tier_3",
        grantId: gid,
      };
    }
    return {
      allowed: true,
      dataMaskingTier: "masked",
      legalBasis: "grant",
      accessType: "masked",
      accessLevel: "tier_1",
      grantId: gid,
    };
  }

  if (requested === "sensitive") {
    const grantSensitive = grant && grant.access_level === "sensitive";
    if (!grantSensitive && !breakGlassActive) {
      return {
        allowed: false,
        dataMaskingTier: "metadata",
        legalBasis: "metadata_default",
        accessType: "sensitive",
        accessLevel: "tier_2",
      };
    }
    if (breakGlassActive) {
      const tier: AccessDecision["dataMaskingTier"] = max === "masked" ? "masked" : "sensitive";
      return {
        allowed: true,
        dataMaskingTier: tier,
        legalBasis: "break_glass",
        accessType: "break_glass",
        accessLevel: "tier_3",
        grantId: gid,
      };
    }
    if (max === "masked") {
      return {
        allowed: true,
        dataMaskingTier: "masked",
        legalBasis: "grant",
        accessType: "masked",
        accessLevel: "tier_2",
        grantId: gid,
      };
    }
    return {
      allowed: true,
      dataMaskingTier: "sensitive",
      legalBasis: "grant",
      accessType: "sensitive",
      accessLevel: "tier_2",
      grantId: gid,
    };
  }

  return {
    allowed: false,
    dataMaskingTier: "metadata",
    legalBasis: "metadata_default",
    accessType: "metadata",
    accessLevel: "tier_0",
  };
}

export async function resolveEmployeeAccess(input: {
  admin: SupabaseClient;
  employeeUserId: string;
  phase4Role: EmployeePhase4Role;
  orgId: string;
  requestedLevel: EmployeeDataRequestLevel;
}): Promise<AccessDecision> {
  const { admin, employeeUserId, phase4Role, orgId, requestedLevel } = input;

  const grant = await findActiveGrant(admin, orgId, employeeUserId);
  const bg = await findActiveBreakGlassForOrg(admin, orgId);
  const breakGlassActive = Boolean(bg);

  const decision = evaluateEmployeeDataAccess(requestedLevel, phase4Role, grant, breakGlassActive);
  if (breakGlassActive && bg?.id) {
    return { ...decision, breakGlassEventId: bg.id };
  }
  return decision;
}
