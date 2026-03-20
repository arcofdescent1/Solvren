/**
 * Phase 2 — Normalize object fields for matching (§10.1).
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

export function normalizeDomain(domain: string | null | undefined): string | null {
  if (domain == null || typeof domain !== "string") return null;
  let d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  if (d.startsWith("www.")) d = d.slice(4);
  if (!d || d.length < 3) return null;
  return d;
}

export function normalizeName(name: string | null | undefined): string | null {
  if (name == null || typeof name !== "string") return null;
  const t = name.trim();
  return t.length > 0 ? t : null;
}

export function extractPrimaryEmail(payload: Record<string, unknown>): string | null {
  const email =
    payload.email ??
    payload.primary_email ??
    (payload.properties as Record<string, unknown>)?.email ??
    (payload.properties as Record<string, unknown>)?.primary_email;
  return normalizeEmail(typeof email === "string" ? email : null);
}

/** Extract domain from a payload (object with domain/website/etc.). */
export function extractDomain(payload: Record<string, unknown>): string | null {
  const domain =
    payload.domain ??
    payload.website ??
    (payload.properties as Record<string, unknown>)?.domain ??
    (payload.properties as Record<string, unknown>)?.website ??
    (payload.properties as Record<string, unknown>)?.hs_domain;
  const raw = typeof domain === "string" ? domain : null;
  return normalizeDomain(raw);
}

/** Domain from an email string (e.g. user@company.com -> company.com). */
export function domainFromEmail(email: string | null | undefined): string | null {
  if (email == null || typeof email !== "string" || !email.includes("@")) return null;
  const part = email.trim().toLowerCase().split("@")[1];
  return normalizeDomain(part ?? null);
}

export function extractFullName(payload: Record<string, unknown>): string | null {
  const first = (payload.firstname ?? (payload.properties as Record<string, unknown>)?.firstname ?? payload.first_name) as string | undefined;
  const last = (payload.lastname ?? (payload.properties as Record<string, unknown>)?.lastname ?? payload.last_name) as string | undefined;
  if (first && last) return `${String(first).trim()} ${String(last).trim()}`.trim() || null;
  const full = (payload.full_name ?? payload.name ?? (payload.properties as Record<string, unknown>)?.name) as string | undefined;
  return normalizeName(full ?? null);
}
