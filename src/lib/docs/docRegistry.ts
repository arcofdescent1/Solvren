/**
 * Docs registry. Maps slug path to file path.
 */
export const DOC_REGISTRY: { slug: string[]; file: string }[] = [
  { slug: ["get-started"], file: "get-started/index.mdx" },
  { slug: ["get-started", "setup"], file: "get-started/setup.mdx" },
  { slug: ["get-started", "first-change"], file: "get-started/first-change.mdx" },
  { slug: ["guides", "user-guide"], file: "guides/user-guide.mdx" },
  { slug: ["admin", "organization-setup"], file: "admin/organization-setup.mdx" },
  { slug: ["admin", "users-roles"], file: "admin/users-roles.mdx" },
  { slug: ["admin", "approval-mappings"], file: "admin/approval-mappings.mdx" },
  { slug: ["admin", "domain-permissions"], file: "admin/domain-permissions.mdx" },
  { slug: ["security", "rbac"], file: "security/rbac.mdx" },
  { slug: ["security", "restricted-visibility"], file: "security/restricted-visibility.mdx" },
  { slug: ["security", "auditability"], file: "security/auditability.mdx" },
  { slug: ["uat", "seed-data"], file: "uat/seed-data.mdx" },
  { slug: ["uat", "test-scripts"], file: "uat/test-scripts.mdx" },
  { slug: ["architecture", "overview"], file: "architecture/overview.mdx" },
  { slug: ["architecture", "revenue-impact-report"], file: "architecture/revenue-impact-report.mdx" },
  { slug: ["architecture", "coordination-autopilot"], file: "architecture/coordination-autopilot.mdx" },
  { slug: ["faq"], file: "faq.mdx" },
  { slug: ["releases"], file: "releases.mdx" },
];
