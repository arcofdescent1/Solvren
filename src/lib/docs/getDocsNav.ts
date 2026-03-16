import type { DocsNavGroup } from "./docTypes";
import { getAllDocs } from "./getAllDocs";

const SECTION_ORDER = [
  "Get Started",
  "Product Guides",
  "Guides",
  "Admin & Governance",
  "Admin",
  "Security & Permissions",
  "Security",
  "UAT & Testing",
  "UAT",
  "Architecture & API",
  "Architecture",
  "FAQ",
  "Releases",
  "Other",
];

export function getDocsNav(): DocsNavGroup[] {
  const docs = getAllDocs();
  const bySection = new Map<string, typeof docs>();
  for (const doc of docs) {
    const list = bySection.get(doc.frontmatter.section) ?? [];
    list.push(doc);
    bySection.set(doc.frontmatter.section, list);
  }
  const groups: DocsNavGroup[] = [];
  for (const section of SECTION_ORDER) {
    const items = bySection.get(section);
    if (items?.length) {
      const sorted = [...items].sort((a, b) => a.frontmatter.order - b.frontmatter.order);
      groups.push({
        section,
        items: sorted.map((d) => ({
          title: d.frontmatter.title,
          href: d.href,
          description: d.frontmatter.description,
          order: d.frontmatter.order,
          tags: d.frontmatter.tags,
        })),
      });
    }
  }
  return groups;
}
