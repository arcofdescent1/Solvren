import { getAllDocs } from "./getAllDocs";
import type { DocsRoleShortcut } from "./docTypes";

const LABELS: Record<DocsRoleShortcut["role"], { title: string; description: string }> = {
  owner: { title: "Owner essentials", description: "Organization setup, governance controls, and executive visibility." },
  admin: { title: "Admin essentials", description: "Users, mappings, permissions, and operational configuration." },
  submitter: { title: "Submitter essentials", description: "Create, coordinate, and submit revenue-impacting changes." },
  reviewer: { title: "Reviewer essentials", description: "Queues, evidence, approvals, and risk review." },
  viewer: { title: "Viewer essentials", description: "Read-only visibility into dashboards, changes, and context." },
  executive: { title: "Executive essentials", description: "Risk visibility, blocked work, and high-level decision support." },
};

export function getRoleShortcuts(): DocsRoleShortcut[] {
  const docs = getAllDocs();
  const roles: DocsRoleShortcut["role"][] = ["owner", "admin", "submitter", "reviewer", "viewer", "executive"];

  return roles
    .map((role) => {
      const first = docs.filter((d) => d.frontmatter.roles?.includes(role)).sort((a, b) => a.frontmatter.order - b.frontmatter.order)[0];
      if (!first) return null;
      return {
        role,
        title: LABELS[role].title,
        description: LABELS[role].description,
        href: first.href,
      } satisfies DocsRoleShortcut;
    })
    .filter((r): r is DocsRoleShortcut => r !== null);
}
