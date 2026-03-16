import { getAllDocs } from "./getAllDocs";
import { getHeadings } from "./getHeadings";
import type { DocsSearchResult } from "./docTypes";

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function makeSnippet(raw: string, q: string): string {
  const plain = raw.replace(/[#_*`>-]/g, " ").replace(/\s+/g, " ").trim();
  const lower = plain.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return plain.slice(0, 180);
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + ql.length + 120);
  return plain.slice(start, end).trim();
}

function score(
  title: string,
  desc: string,
  headings: string[],
  body: string,
  q: string,
  tags: string[] = [],
  roles: string[] = []
): number {
  const qn = normalize(q);
  const tn = normalize(title);
  const dn = normalize(desc);
  const hn = normalize(headings.join(" "));
  const bn = normalize(body);
  const tgn = normalize(tags.join(" "));
  const rn = normalize(roles.join(" "));
  let s = 0;
  if (tn === qn) s += 100;
  if (tn.startsWith(qn)) s += 50;
  if (tn.includes(qn)) s += 30;
  if (hn.includes(qn)) s += 20;
  if (dn.includes(qn)) s += 15;
  if (tgn.includes(qn)) s += 12;
  if (rn.includes(qn)) s += 8;
  if (bn.includes(qn)) s += 10;
  const parts = qn.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    if (tn.includes(p)) s += 10;
    if (hn.includes(p)) s += 5;
    if (dn.includes(p)) s += 4;
    if (tgn.includes(p)) s += 4;
    if (rn.includes(p)) s += 3;
    if (bn.includes(p)) s += 2;
  }
  return s;
}

export function searchDocs(query: string): DocsSearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const docs = getAllDocs();
  const withScores = docs.map((doc) => {
    const headings = getHeadings(doc.rawContent);
    const s = score(
      doc.frontmatter.title,
      doc.frontmatter.description,
      headings,
      doc.rawContent,
      q,
      doc.frontmatter.tags ?? [],
      doc.frontmatter.roles ?? []
    );
    const result: DocsSearchResult = {
      title: doc.frontmatter.title,
      description: doc.frontmatter.description,
      href: doc.href,
      section: doc.frontmatter.section,
      headings,
      snippet: makeSnippet(doc.rawContent, q),
      tags: doc.frontmatter.tags ?? [],
      roles: doc.frontmatter.roles ?? [],
    };
    return { score: s, result };
  });
  return withScores
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => x.result);
}
