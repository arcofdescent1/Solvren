import type { OrgRole } from "./roles";

/** Canonical permissions (stored in RBAC checks). */
export type CanonicalPermission =
  | "dashboard.view"
  | "change.view"
  | "change.create"
  | "change.edit.own_draft"
  | "change.submit"
  | "change.approve"
  | "change.comment"
  | "change.evidence.provide"
  | "queue.view"
  | "queue.admin.view"
  | "org.users.manage"
  | "org.settings.view"
  | "org.settings.manage"
  | "approval.mappings.manage"
  | "admin.jobs.view"
  | "integrations.view"
  | "integrations.manage"
  | "admin.simulations.manage"
  | "policy.manage"
  | "domains.manage"
  | "identity.view";

/** Phase 0 spec aliases — normalize via normalizePermission() before role lookup. */
export type PermissionAlias =
  | "changes.view"
  | "changes.create"
  | "changes.edit"
  | "changes.submit"
  | "changes.approve";

export type Permission = CanonicalPermission | PermissionAlias;

const ALIAS_TO_CANONICAL: Record<PermissionAlias, CanonicalPermission> = {
  "changes.view": "change.view",
  "changes.create": "change.create",
  "changes.edit": "change.edit.own_draft",
  "changes.submit": "change.submit",
  "changes.approve": "change.approve",
};

export function normalizePermission(p: Permission): CanonicalPermission {
  if (p in ALIAS_TO_CANONICAL) {
    return ALIAS_TO_CANONICAL[p as PermissionAlias];
  }
  return p as CanonicalPermission;
}

const ROLE_PERMISSIONS: Record<OrgRole, Set<CanonicalPermission>> = {
  OWNER: new Set<CanonicalPermission>([
    "dashboard.view",
    "change.view",
    "change.create",
    "change.edit.own_draft",
    "change.submit",
    "change.approve",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
    "queue.admin.view",
    "org.users.manage",
    "org.settings.view",
    "org.settings.manage",
    "approval.mappings.manage",
    "admin.jobs.view",
    "integrations.view",
    "integrations.manage",
    "admin.simulations.manage",
    "policy.manage",
    "domains.manage",
    "identity.view",
  ]),
  ADMIN: new Set<CanonicalPermission>([
    "dashboard.view",
    "change.view",
    "change.create",
    "change.edit.own_draft",
    "change.submit",
    "change.approve",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
    "queue.admin.view",
    "org.users.manage",
    "org.settings.view",
    "org.settings.manage",
    "approval.mappings.manage",
    "admin.jobs.view",
    "integrations.view",
    "integrations.manage",
    "admin.simulations.manage",
    "policy.manage",
    "domains.manage",
    "identity.view",
  ]),
  REVIEWER: new Set<CanonicalPermission>([
    "dashboard.view",
    "change.view",
    "change.create",
    "change.edit.own_draft",
    "change.submit",
    "change.approve",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
    "org.settings.view",
    "integrations.view",
    "identity.view",
  ]),
  SUBMITTER: new Set<CanonicalPermission>([
    "dashboard.view",
    "change.view",
    "change.create",
    "change.edit.own_draft",
    "change.submit",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
    "org.settings.view",
    "integrations.view",
  ]),
  VIEWER: new Set<CanonicalPermission>([
    "dashboard.view",
    "change.view",
    "queue.view",
    "org.settings.view",
    "integrations.view",
  ]),
};

export function canRole(role: OrgRole, permission: Permission): boolean {
  const canonical = normalizePermission(permission);
  return ROLE_PERMISSIONS[role].has(canonical);
}
