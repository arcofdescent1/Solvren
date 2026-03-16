import { getAllDocs } from "./getAllDocs";
import type { DocItem } from "./docTypes";

export function getDocBySlug(slug: string[]): DocItem | null {
  const docs = getAllDocs();
  const match = docs.find(
    (d) =>
      d.slug.length === slug.length &&
      d.slug.every((s, i) => s === slug[i])
  );
  return match ?? null;
}
