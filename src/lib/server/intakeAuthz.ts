import { AuthzError } from "@/lib/server/authz";
import { isAdminLikeRole, type OrgRole } from "@/lib/rbac/roles";
import { canRole } from "@/lib/rbac/permissions";

/** Spreadsheet import: reviewer and above (Phase 3). */
export function assertCanImportSpreadsheet(role: OrgRole): void {
  if (role === "REVIEWER" || isAdminLikeRole(role)) return;
  throw new AuthzError(403, "Spreadsheet import requires reviewer or admin access");
}

/** Custom source admin APIs: owner/admin only. */
export function assertCanManageCustomSources(role: OrgRole): void {
  if (isAdminLikeRole(role)) return;
  throw new AuthzError(403, "Custom sources can only be managed by organization admins");
}

/** Test webhook (sign sample): reviewer and above. */
export function assertCanTestCustomSource(role: OrgRole): void {
  if (role === "REVIEWER" || isAdminLikeRole(role)) return;
  throw new AuthzError(403, "Not allowed to test custom sources");
}

/** Manual intake: any role with change.create (excludes viewer/reviewer before Phase 3; reviewers now create). */
export function assertCanCreateManualIntake(role: OrgRole): void {
  if (!canRole(role, "change.create")) {
    throw new AuthzError(403, "You do not have permission to create intake");
  }
}
