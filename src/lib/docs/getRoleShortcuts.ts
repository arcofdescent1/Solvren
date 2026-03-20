import { getAllDocs } from "./getAllDocs";
import type { DocsRoleShortcut } from "./docTypes";

const LABELS: Record<DocsRoleShortcut["role"], { title: string; description: string }> = {
  owner: { title: "Admin / Platform Owner", description: "Organization setup, Policy Center, and executive visibility." },
  admin: { title: "Admin essentials", description: "Integrations, playbooks, policies, and operational configuration." },
  submitter: { title: "RevOps / Finance", description: "Issues, playbooks, verification, and ROI." },
  reviewer: { title: "Engineering / IT", description: "Issues inbox, approvals, and action execution." },
  viewer: { title: "Viewer essentials", description: "Read-only visibility into dashboards, issues, and ROI." },
  executive: { title: "Executives", description: "ROI dashboard, recovered value, and high-level decision support." },
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
