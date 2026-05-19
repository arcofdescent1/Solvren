import {
  IMPLEMENTATION_MODES,
  LICENSE_STATUSES,
  LICENSE_TIERS,
  PREMIUM_MODULES,
  PROTECTED_REVENUE_BANDS,
  type ImplementationMode,
  type LicenseStatus,
  type LicenseTier,
  type PremiumModule,
  type ProtectedRevenueBand,
} from "./types";

function upper(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

export function normalizeLicenseTier(v: unknown): LicenseTier {
  const s = upper(v);
  if (s === "STRATEGIC" || s === "STRATEGIC_ENTERPRISE") return "STRATEGIC_ENTERPRISE";
  if (s === "ENTERPRISE") return "ENTERPRISE";
  if (s === "BUSINESS" || s === "GROWTH") return "BUSINESS";
  if (s === "TEAM" || s === "PRO" || s === "STARTER") return "TEAM";
  if ((LICENSE_TIERS as readonly string[]).includes(s)) return s as LicenseTier;
  return "FREE";
}

export function normalizeLicenseStatus(v: unknown): LicenseStatus {
  const s = upper(v);
  if (s === "CANCELLED") return "CANCELED";
  if ((LICENSE_STATUSES as readonly string[]).includes(s)) return s as LicenseStatus;
  return "ACTIVE";
}

export function normalizeProtectedRevenueBand(v: unknown): ProtectedRevenueBand {
  const s = upper(v).replace(/\$/g, "").replace(/-/g, "_");
  const aliases: Record<string, ProtectedRevenueBand> = {
    UNDER_25M: "UNDER_25M",
    LT_25M: "UNDER_25M",
    "25M_100M": "25M_100M",
    "100M_250M": "100M_250M",
    "250M_1B": "250M_1B",
    "1B_PLUS": "1B_PLUS",
    OVER_1B: "1B_PLUS",
  };
  if (aliases[s]) return aliases[s];
  if ((PROTECTED_REVENUE_BANDS as readonly string[]).includes(s)) return s as ProtectedRevenueBand;
  return "UNSET";
}

export function normalizeImplementationMode(v: unknown, tier: LicenseTier): ImplementationMode {
  const s = upper(v);
  if ((IMPLEMENTATION_MODES as readonly string[]).includes(s)) return s as ImplementationMode;
  if (tier === "STRATEGIC_ENTERPRISE") return "WHITE_GLOVE";
  if (tier === "ENTERPRISE") return "GUIDED";
  return "SELF_SERVE";
}

export function normalizePremiumModules(v: unknown): PremiumModule[] {
  const raw = Array.isArray(v) ? v : [];
  const modules = raw
    .map((item) => upper(item))
    .filter((item): item is PremiumModule => (PREMIUM_MODULES as readonly string[]).includes(item));
  return Array.from(new Set(modules));
}

export function isLicenseActive(status: unknown, tier: unknown): boolean {
  if (normalizeLicenseTier(tier) === "FREE") return false;
  const s = normalizeLicenseStatus(status);
  return s === "ACTIVE" || s === "TRIALING" || s === "PAST_DUE";
}
