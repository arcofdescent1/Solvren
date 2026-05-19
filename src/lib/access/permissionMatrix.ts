import type { OrgRole } from "@/lib/rbac/roles";

export type PermissionMatrixAction =
  | "view"
  | "edit"
  | "comment"
  | "provide_evidence"
  | "submit"
  | "approve"
  | "restrict"
  | "grant_access";

export type PermissionMatrixRow = {
  role: OrgRole;
  action: PermissionMatrixAction;
  allowedWhen: string;
  customerExplanation: string;
};

export const CHANGE_PERMISSION_MATRIX: PermissionMatrixRow[] = [
  {
    role: "OWNER",
    action: "view",
    allowedWhen: "Any active change in the organization, including restricted changes.",
    customerExplanation: "Executive owners can inspect the complete revenue-protection record.",
  },
  {
    role: "ADMIN",
    action: "view",
    allowedWhen: "Any active change in the organization, including restricted changes.",
    customerExplanation: "Admins can operate and support governance across the tenant.",
  },
  {
    role: "REVIEWER",
    action: "view",
    allowedWhen: "Assigned, explicitly granted, or domain-visible IN_REVIEW/APPROVED changes.",
    customerExplanation: "Reviewers see work where they are accountable or have domain visibility.",
  },
  {
    role: "SUBMITTER",
    action: "view",
    allowedWhen: "Own changes, assigned changes, explicitly granted restricted changes, and approved domain-visible changes.",
    customerExplanation: "Submitters can track their work without seeing every in-flight decision.",
  },
  {
    role: "VIEWER",
    action: "view",
    allowedWhen: "Approved domain-visible changes only.",
    customerExplanation: "Viewers get business visibility without operational control.",
  },
  {
    role: "OWNER",
    action: "edit",
    allowedWhen: "Any active change.",
    customerExplanation: "Owners can correct business metadata and revenue exposure when accountable.",
  },
  {
    role: "ADMIN",
    action: "edit",
    allowedWhen: "Any active change.",
    customerExplanation: "Admins can keep change records complete and auditable.",
  },
  {
    role: "REVIEWER",
    action: "edit",
    allowedWhen: "Assigned SUBMITTED or IN_REVIEW changes.",
    customerExplanation: "Assigned reviewers can correct review metadata while a decision is active.",
  },
  {
    role: "SUBMITTER",
    action: "edit",
    allowedWhen: "Own DRAFT or READY changes.",
    customerExplanation: "Submitters can prepare their own changes before formal review starts.",
  },
  {
    role: "VIEWER",
    action: "edit",
    allowedWhen: "Never.",
    customerExplanation: "Viewer access is read-only.",
  },
  {
    role: "REVIEWER",
    action: "approve",
    allowedWhen: "The reviewer has change approval permission, can view the change, and has domain review permission.",
    customerExplanation: "Approval authority is scoped to assigned/domain-appropriate reviewers.",
  },
  {
    role: "OWNER",
    action: "restrict",
    allowedWhen: "Any change in the organization.",
    customerExplanation: "Owners can restrict sensitive revenue-change records.",
  },
  {
    role: "ADMIN",
    action: "restrict",
    allowedWhen: "Any change in the organization.",
    customerExplanation: "Admins can restrict sensitive revenue-change records.",
  },
  {
    role: "SUBMITTER",
    action: "restrict",
    allowedWhen: "Own change.",
    customerExplanation: "Creators can restrict sensitive drafts they own.",
  },
];

export const TRUST_AUDIT_COVERAGE = [
  "Revenue exposure edits",
  "Change restriction and explicit access updates",
  "Approval decisions",
  "Evidence submission and evidence status changes",
  "Domain permission changes",
  "Integration connect, disconnect, test, and health actions",
  "Executive decisions",
  "Support access approval, denial, revocation, and break-glass flows",
  "Tenant purge dry-run, approval, verification, and execution",
] as const;

export function matrixRowsForRole(role: OrgRole) {
  return CHANGE_PERMISSION_MATRIX.filter((row) => row.role === role);
}
