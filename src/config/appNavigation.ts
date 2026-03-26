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
  | "actions"
  | "insights"
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
    label: "Home",
    href: "/home",
    icon: LayoutDashboard,
    activeMatch: ["/home", "/dashboard"],
    description: "Your revenue risk command center.",
  },
  {
    key: "issues",
    label: "Issues",
    href: "/issues",
    icon: AlertCircle,
    activeMatch: ["/issues"],
    description: "Detected revenue-impacting problems.",
  },
  {
    key: "changes",
    label: "Changes",
    href: "/changes",
    icon: FileCheck,
    activeMatch: ["/changes", "/reviews", "/queue"],
    description: "Revenue-impacting changes in flight.",
  },
  {
    key: "actions",
    label: "Action Center",
    href: "/actions",
    icon: ListTodo,
    activeMatch: ["/actions", "/ops"],
    description: "Everything that needs action now.",
  },
  {
    key: "insights",
    label: "Insights",
    href: "/insights",
    icon: BarChart3,
    activeMatch: ["/insights", "/executive", "/reports", "/risk"],
    description: "Exposure, ROI, and governance health.",
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

