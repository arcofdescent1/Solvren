/**
 * Phase 2 digest formatting helpers (used by digest enqueue and future UI).
 */
export function formatAttentionDigestSection(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `*${title}*\n${lines.map((l) => `• ${l}`).join("\n")}`;
}
