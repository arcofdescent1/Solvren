/**
 * Phase 5 — Human-readable OAuth scope labels + handling (extend per provider).
 */
import type { PrivacyMode } from "@/lib/server/privacy/privacy-policy";

export type ScopeEntry = {
  scope: string;
  label: string;
  handling: string;
};

const HUBSPOT: ScopeEntry[] = [
  {
    scope: "crm.objects.contacts.read",
    label: "Read contacts",
    handling: "Emails hashed; names redacted in minimal mode",
  },
  {
    scope: "crm.objects.deals.read",
    label: "Read deals",
    handling: "Operational metadata and bands; no raw payload storage",
  },
];

const STRIPE: ScopeEntry[] = [
  {
    scope: "read_only",
    label: "Read charges, invoices, subscriptions",
    handling: "Sanitized operational events; PII fields redacted",
  },
];

const SALESFORCE: ScopeEntry[] = [
  {
    scope: "api",
    label: "API access (read-oriented)",
    handling: "Object metadata and operational signals; PII minimized",
  },
];

const DEFAULT: ScopeEntry[] = [
  {
    scope: "integration",
    label: "Connected integration",
    handling: "See organization privacy mode and data handling summary",
  },
];

export function scopesForProvider(provider: string): ScopeEntry[] {
  const p = provider.toLowerCase();
  if (p === "hubspot") return HUBSPOT;
  if (p === "stripe") return STRIPE;
  if (p === "salesforce") return SALESFORCE;
  return DEFAULT;
}

export function integrationScopesResponse(input: {
  provider: string;
  writeBackEnabled: boolean;
  privacyMode: PrivacyMode;
  /** If stored on account; else derived from provider defaults */
  requestedScopes?: string[] | null;
}): {
  provider: string;
  requestedScopes: ScopeEntry[];
  writeAccess: boolean;
  privacyMode: PrivacyMode;
} {
  const catalog = scopesForProvider(input.provider);
  const requested = input.requestedScopes?.length
    ? catalog.filter((c) => input.requestedScopes!.includes(c.scope))
    : catalog;

  return {
    provider: input.provider,
    requestedScopes: requested.length ? requested : catalog,
    writeAccess: input.writeBackEnabled,
    privacyMode: input.privacyMode,
  };
}
