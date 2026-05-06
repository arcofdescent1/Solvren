import type { InternalEmployeeRole } from "@/lib/internal/employeeRoles";

export type EmployeePhase4Role = "SUPPORT" | "IMPLEMENTATION" | "ENGINEERING" | "SECURITY" | "ADMIN";

export type EmployeeProfileStatus = "active" | "suspended" | "terminated";

export type EmployeeProfile = {
  id: string;
  userId: string;
  email: string;
  role: EmployeePhase4Role;
  status: EmployeeProfileStatus;
};

/** Map Phase 4 RBAC to legacy internal permission buckets (until permissions are migrated). */
export function phase4RoleToInternalEmployeeRole(role: EmployeePhase4Role): InternalEmployeeRole {
  switch (role) {
    case "ADMIN":
      return "super_admin";
    case "ENGINEERING":
    case "SECURITY":
      return "technical_support";
    case "IMPLEMENTATION":
      return "account_ops";
    case "SUPPORT":
    default:
      return "support_admin";
  }
}

/** Max data tier this role may receive even if customer approved higher. */
export function phase4RoleMaxMaskingTier(role: EmployeePhase4Role): "masked" | "sensitive" {
  if (role === "SUPPORT") return "masked";
  return "sensitive";
}

export function canInitiateBreakGlass(role: EmployeePhase4Role): boolean {
  return role === "SECURITY" || role === "ENGINEERING" || role === "ADMIN";
}
