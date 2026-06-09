import type { LucideIcon } from "lucide-react";
import { DEEP_LINK_NAV, HELP_DOCS_LANGUAGE, UNIVERSAL_NAV } from "@/config/productLanguage";

export type AppNavKey =
  | "home"
  | "issues"
  | "changes"
  | "queue"
  | "impact"
  | "integrations"
  | "settings"
  | "decisions"
  | "problems"
  | "proof"
  | "setup";

export type AppNavItem = {
  key: AppNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  activeMatch: string[];
  description: string;
};

export const PRIMARY_APP_NAV: AppNavItem[] = UNIVERSAL_NAV;

export const HELP_DOCS_NAV_ITEM = {
  label: HELP_DOCS_LANGUAGE.label,
  href: HELP_DOCS_LANGUAGE.href,
  icon: HELP_DOCS_LANGUAGE.icon,
};

export const SECONDARY_APP_NAV = DEEP_LINK_NAV;
