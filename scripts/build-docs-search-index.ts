import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";

type SearchDoc = {
  title: string;
  description: string;
  section: string;
  href: string;
  content: string;
};

const DOCS_ROOT = path.join(process.cwd(), "content", "docs");
const OUTPUT_PATH = path.join(process.cwd(), "public", "docs-search-index.json");

function stripMdx(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toHref(filePath: string): string {
  const rel = path.relative(DOCS_ROOT, filePath).replace(/\\/g, "/");
  const noExt = rel.replace(/\.mdx?$/, "");

  if (noExt.endsWith("/index")) {
    return `/docs/${noExt.replace(/\/index$/, "")}` || "/docs";
  }

  return `/docs/${noExt}`;
}

async function main() {
  const files = await fg(["**/*.mdx"], {
    cwd: DOCS_ROOT,
    absolute: true,
  });

  const docs: SearchDoc[] = files.map((file) => {
    const raw = fs.readFileSync(file, "utf8");
    const { data, content } = matter(raw);

    return {
      title: String(data.title ?? ""),
      description: String(data.description ?? ""),
      section: String(data.section ?? ""),
      href: toHref(file),
      content: stripMdx(content),
    };
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(docs, null, 2), "utf8");

  console.log(`Built docs search index with ${docs.length} documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
