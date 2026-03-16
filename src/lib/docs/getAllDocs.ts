import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { DocItem, DocFrontmatter } from "./docTypes";

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function getAllDocs(): DocItem[] {
  if (!fs.existsSync(DOCS_ROOT)) return [];

  const files = walk(DOCS_ROOT);

  return files.map((filePath) => {
    const file = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(file);

    const relative = path.relative(DOCS_ROOT, filePath).replace(/\\/g, "/");
    const slug = relative.replace(/\.mdx$/, "").split("/");
    const normalizedSlug =
      slug[slug.length - 1] === "index" ? slug.slice(0, -1) : slug;
    const href =
      normalizedSlug.length > 0 ? `/docs/${normalizedSlug.join("/")}` : "/docs";

    return {
      slug: normalizedSlug,
      href,
      frontmatter: {
        title: (data.title as string) ?? normalizedSlug[normalizedSlug.length - 1] ?? "Untitled",
        description: (data.description as string) ?? "",
        section: (data.section as string) ?? "Other",
        order: Number(data.order) ?? 999,
        toc: data.toc ?? true,
        icon: data.icon,
        tags: data.tags ?? [],
        roles: data.roles ?? [],
        lastUpdated: data.lastUpdated,
      } satisfies DocFrontmatter,
      rawContent: content,
      relativePath: relative,
    };
  });
}
