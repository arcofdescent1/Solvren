import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Building2,
  FileCheck,
  LayoutDashboard,
  ListTodo,
  PlugZap,
  LifeBuoy,
} from "lucide-react";

export type AppNavKey =
  | "home"
  | "issues"
  | "changes"
  | "queue"
  | "impact"
  | "integrations"
  | "settings";

export type AppNavItem = {
  key: AppNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  activeMatch: string[];
  description: string;
};

export const PRIMARY_APP_NAV: AppNavItem[] = [
  {
    key: "home",
    label: "Command Center",
    href: "/home",
    icon: LayoutDashboard,
    activeMatch: ["/home", "/dashboard"],
    description: "What needs attention, what is at risk, and what changed.",
  },
  {
    key: "issues",
    label: "Revenue Risks",
    href: "/issues",
    icon: AlertCircle,
    activeMatch: ["/issues", "/risk"],
    description: "Detected revenue-impacting problems and investigations.",
  },
  {
    key: "queue",
    label: "Work Queue",
    href: "/actions",
    icon: ListTodo,
    activeMatch: ["/actions", "/ops", "/queue", "/reviews"],
    description: "Approvals, evidence, assignments, and follow-up in one place.",
  },
  {
    key: "changes",
    label: "Changes",
    href: "/changes",
    icon: FileCheck,
    activeMatch: ["/changes", "/intake"],
    description: "Revenue-impacting changes from draft through approval.",
  },
  {
    key: "impact",
    label: "Impact",
    href: "/insights",
    icon: BarChart3,
    activeMatch: ["/insights", "/executive", "/reports", "/readiness", "/outcomes", "/roi"],
    description: "Revenue exposure, readiness, ROI, and verified outcomes.",
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: PlugZap,
    activeMatch: ["/integrations", "/marketplace/integrations"],
    description: "System connectivity and monitoring health.",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: Building2,
    activeMatch: ["/settings", "/org/settings", "/admin"],
    description: "Organization and governance configuration.",
  },
];

export const HELP_DOCS_NAV_ITEM = {
  label: "Help & Docs",
  href: "/docs",
  icon: LifeBuoy,
};

export const SECONDARY_APP_NAV = [
  { label: "Readiness", href: "/readiness", description: "Release and portfolio readiness" },
  { label: "Outcomes", href: "/outcomes", description: "Verified value and prevented loss" },
  { label: "Executive view", href: "/executive", description: "Leadership summaries" },
  { label: "ROI", href: "/insights/roi", description: "Impact trend and value proof" },
  { label: "Governance reports", href: "/insights/governance-reports", description: "Exportable governance evidence" },
] as const;
