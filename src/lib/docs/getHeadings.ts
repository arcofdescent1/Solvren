export function getHeadings(rawContent: string): string[] {
  const lines = rawContent.split("\n");
  const headings: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    if (h2) headings.push(h2[1].trim());
    if (h3) headings.push(h3[1].trim());
  }
  return headings;
}
