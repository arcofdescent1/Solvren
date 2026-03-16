import type { TocItem } from "./docTypes";

/**
 * Parse markdown content for h2 and h3 headings to build TOC.
 */
export function getToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2) {
      items.push({
        id: slugify(h2[1]),
        text: h2[1].replace(/#+\s*$/, "").trim(),
        level: 2,
      });
    } else if (h3) {
      items.push({
        id: slugify(h3[1]),
        text: h3[1].replace(/#+\s*$/, "").trim(),
        level: 3,
      });
    }
  }
  return items;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
