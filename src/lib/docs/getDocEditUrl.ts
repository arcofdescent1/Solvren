import { DOCS_CONTENT_BASE, DOCS_EDIT_BASE_URL } from "./docConfig";
import type { DocItem } from "./docTypes";

export function getDocEditUrl(doc: DocItem): string {
  const p = doc.relativePath ?? `${doc.slug.join("/") || "index"}.mdx`;
  return DOCS_EDIT_BASE_URL.replace(/\/$/, "") + "/" + DOCS_CONTENT_BASE + "/" + p;
}
