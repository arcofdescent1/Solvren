/**
 * Organization slug and domain helpers (used by org create and tests).
 */

export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "org";
}

export function extractPrimaryDomain(website: string | null | undefined): string | null {
  if (!website || typeof website !== "string") return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
