/**
 * Normalize OIDC claims to internal identity schema
 */
export type NormalizedIdentity = {
  externalSubject: string;
  email: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  groups: string[];
  department: string | null;
  rawClaims: Record<string, unknown>;
};

export function normalizeOidcClaims(
  payload: Record<string, unknown>,
  attributeMappings?: Record<string, string>
): NormalizedIdentity {
  const get = (key: string, defaults: string[]): string | undefined => {
    const mapped = attributeMappings?.[key];
    if (mapped && payload[mapped] !== undefined) return String(payload[mapped] ?? "");
    for (const d of defaults) {
      if (payload[d] !== undefined) return String(payload[d] ?? "");
    }
    return undefined;
  };

  const email = get("email", ["email", "preferred_username"]) ?? "";
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const givenName = get("given_name", ["given_name", "firstName"]) ?? null;
  const familyName = get("family_name", ["family_name", "lastName", "surname"]) ?? null;
  const name = get("name", ["name"]) ?? null;
  const displayName = name || [givenName, familyName].filter(Boolean).join(" ") || null;

  let groups: string[] = [];
  const g = payload.groups ?? payload.group ?? payload.member_of;
  if (Array.isArray(g)) groups = g.map((x) => String(x ?? ""));
  else if (typeof g === "string") groups = g.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const department = get("department", ["department"]) ?? null;

  return {
    externalSubject: String(payload.sub ?? ""),
    email,
    emailVerified,
    givenName: givenName || null,
    familyName: familyName || null,
    displayName: displayName || null,
    groups,
    department,
    rawClaims: { ...payload },
  };
}
