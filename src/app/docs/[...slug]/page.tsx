import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsContent,
  DocsBreadcrumbs,
  TableOfContents,
  DocsPagination,
  DocsPageActions,
  DocsPageViewTracker,
  DocsTagChips,
  DocsLastUpdated,
} from "@/components/docs";
import { getDocBySlug } from "@/lib/docs/getDocBySlug";
import { getDocEditUrl } from "@/lib/docs/getDocEditUrl";
import { getDocFeedbackUrl } from "@/lib/docs/getDocFeedbackUrl";
import { getAllDocs } from "@/lib/docs/getAllDocs";
import type { DocItem } from "@/lib/docs/docTypes";

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return { title: "Docs | Solvren" };
  return {
    title: `${doc.frontmatter.title} | Solvren Docs`,
    description: doc.frontmatter.description,
  };
}

type Props = {
  params: Promise<{ slug: string[] }>;
};

function getPrevNext(current: DocItem, all: DocItem[]): {
  prev: { title: string; href: string } | null;
  next: { title: string; href: string } | null;
} {
  const idx = all.findIndex(
    (d) =>
      d.slug.length === current.slug.length &&
      d.slug.every((s, i) => s === current.slug[i])
  );
  if (idx < 0) return { prev: null, next: null };
  const toMeta = (d: DocItem) => ({ title: d.frontmatter.title, href: d.href });
  return {
    prev: idx > 0 ? toMeta(all[idx - 1]!) : null,
    next: idx < all.length - 1 ? toMeta(all[idx + 1]!) : null,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const showToc = doc.frontmatter.toc !== false;
  const allDocs = getAllDocs().sort((a, b) => {
    const sa = a.frontmatter.section;
    const sb = b.frontmatter.section;
    if (sa !== sb) {
      const order = [
        "Get Started",
        "Product Guides",
        "Admin & Governance",
        "Architecture & API",
      ];
      return order.indexOf(sa) - order.indexOf(sb);
    }
    return a.frontmatter.order - b.frontmatter.order;
  });
  const { prev, next } = getPrevNext(doc, allDocs);

  const editUrl = getDocEditUrl(doc);
  const feedbackUrl = getDocFeedbackUrl(doc);

  const breadcrumbs = [
    { label: "Docs", href: "/docs" },
    ...doc.slug.slice(0, -1).map((s, i) => ({
      label: s.replace(/-/g, " "),
      href: `/docs/${doc.slug.slice(0, i + 1).join("/")}`,
    })),
    { label: doc.frontmatter.title },
  ];

  return (
    <div className="mx-auto flex max-w-[1200px] gap-8">
      <div className="min-w-0 flex-1">
        <DocsPageViewTracker
          title={doc.frontmatter.title}
          href={doc.href}
          section={doc.frontmatter.section}
          tags={doc.frontmatter.tags}
        />
        <DocsBreadcrumbs items={breadcrumbs} />
        <header className="mb-8 border-b border-[var(--border)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            {doc.frontmatter.section}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--text)]">
            {doc.frontmatter.title}
          </h1>
          {doc.frontmatter.description && (
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
              {doc.frontmatter.description}
            </p>
          )}
          <DocsTagChips tags={doc.frontmatter.tags} />
          <DocsLastUpdated value={doc.frontmatter.lastUpdated} />
        </header>
        <DocsContent source={doc.rawContent} />
        <DocsPageActions
          editUrl={editUrl}
          feedbackUrl={feedbackUrl}
          title={doc.frontmatter.title}
          href={doc.href}
        />
        <DocsPagination prev={prev} next={next} />
      </div>
      <TableOfContents enabled={showToc} />
    </div>
  );
}
