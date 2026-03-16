import type { OrgRole } from "./roles";

export type Permission =
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
  | "org.settings.manage"
  | "approval.mappings.manage"
  | "admin.jobs.view";

const ROLE_PERMISSIONS: Record<OrgRole, Set<Permission>> = {
  OWNER: new Set<Permission>([
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
    "org.settings.manage",
    "approval.mappings.manage",
    "admin.jobs.view",
  ]),
  ADMIN: new Set<Permission>([
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
    "org.settings.manage",
    "approval.mappings.manage",
    "admin.jobs.view",
  ]),
  REVIEWER: new Set<Permission>([
    "dashboard.view",
    "change.view",
    "change.approve",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
  ]),
  SUBMITTER: new Set<Permission>([
    "dashboard.view",
    "change.view",
    "change.create",
    "change.edit.own_draft",
    "change.submit",
    "change.comment",
    "change.evidence.provide",
    "queue.view",
  ]),
  VIEWER: new Set<Permission>(["dashboard.view", "change.view", "queue.view"]),
};

export function canRole(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
