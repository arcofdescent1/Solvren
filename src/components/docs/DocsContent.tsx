import { compileMDX } from "next-mdx-remote/rsc";
import { docsComponents } from "./docsMdxComponents";
import { cn } from "@/lib/cn";

export async function DocsContent(p: {
  source: string;
  className?: string;
}) {
  const { content } = await compileMDX({
    source: p.source,
    components: docsComponents,
    options: { parseFrontmatter: false },
  });

  return (
    <article
      className={cn(
        "docs-prose prose min-w-0 max-w-none flex-1",
        "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-[var(--text)]",
        "prose-h1:text-[var(--text)] prose-h2:text-[var(--text)] prose-h3:text-[var(--text)]",
        "prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text)]",
        "prose-code:bg-[var(--bg-muted)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[var(--text)] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[var(--bg-surface-2)] prose-pre:text-[var(--text)]",
        "prose-a:text-[var(--primary)] hover:prose-a:text-[var(--primary-hover)]",
        "prose-table:text-[var(--text)] prose-th:text-[var(--text)]",
        p.className
      )}
    >
      {content}
    </article>
  );
}
