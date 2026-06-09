import {
  AlertCircle,
  BarChart3,
  Building2,
  FileCheck,
  Home,
  LifeBuoy,
  ListTodo,
  PlugZap,
  type LucideIcon,
} from "lucide-react";

export type UniversalNavKey = "home" | "decisions" | "problems" | "proof" | "setup";

export type UniversalNavItem = {
  key: UniversalNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  activeMatch: string[];
  description: string;
};

export const PRODUCT_PROMISE =
  "Solvren shows what revenue is at risk, what needs action, and what value was protected.";

export const UNIVERSAL_PRODUCT_MODEL = {
  headline: "Protect revenue without making every team learn a new operating system.",
  simpleLoop: ["Find risk", "Decide what to do", "Fix the problem", "Prove the value"] as const,
  primaryQuestion: "What needs attention, and how much revenue does it protect?",
  screenTest: [
    "What is this?",
    "Why does it matter?",
    "What should I do?",
    "What happens if I do nothing?",
    "Where is the proof?",
  ] as const,
} as const;

export const UNIVERSAL_NAV: UniversalNavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    icon: Home,
    activeMatch: ["/home", "/dashboard"],
    description: "Money at risk, urgent work, and the value Solvren is protecting.",
  },
  {
    key: "decisions",
    label: "Decisions",
    href: "/actions",
    icon: ListTodo,
    activeMatch: ["/actions", "/ops", "/queue", "/reviews"],
    description: "Approvals, missing proof, blockers, and the next clear action.",
  },
  {
    key: "problems",
    label: "Problems",
    href: "/issues",
    icon: AlertCircle,
    activeMatch: ["/issues", "/risk"],
    description: "Revenue-impacting problems Solvren found across connected systems.",
  },
  {
    key: "proof",
    label: "Proof",
    href: "/insights",
    icon: BarChart3,
    activeMatch: ["/insights", "/executive", "/reports", "/readiness", "/outcomes", "/roi"],
    description: "Revenue exposure, protected value, outcomes, reports, and leadership proof.",
  },
  {
    key: "setup",
    label: "Setup",
    href: "/integrations",
    icon: PlugZap,
    activeMatch: ["/integrations", "/marketplace/integrations", "/settings", "/org/settings", "/admin"],
    description: "Connect systems, invite people, tune rules, and manage organization settings.",
  },
];

export const DEEP_LINK_NAV = [
  { label: "Change reviews", href: "/changes", description: "Revenue-sensitive changes that need proof or approval", icon: FileCheck },
  { label: "Connected systems", href: "/integrations", description: "Integrations, coverage, and system health", icon: PlugZap },
  { label: "Organization setup", href: "/settings", description: "Users, rules, security, and account settings", icon: Building2 },
  { label: "Protected value", href: "/outcomes", description: "Verified value stories and prevented loss", icon: BarChart3 },
  { label: "Leadership view", href: "/executive", description: "Executive summaries and revenue protection narrative", icon: BarChart3 },
  { label: "Reports", href: "/insights/governance-reports", description: "Exportable proof and audit packages", icon: FileCheck },
] as const;

export const HELP_DOCS_LANGUAGE = {
  label: "Help",
  href: "/docs",
  icon: LifeBuoy,
} as const;

export const PRODUCT_TERMS = {
  home: {
    title: "Home",
    description:
      "See money at risk, what needs attention, and what Solvren is already protecting.",
    helper: PRODUCT_PROMISE,
  },
  decisions: {
    title: "Decisions",
    description:
      "The short list of revenue-sensitive work that needs a decision, proof, or follow-up.",
    helper: "Start here when you want the next obvious action.",
  },
  problems: {
    title: "Problems",
    description:
      "Revenue-impacting problems Solvren found across your connected systems.",
    helper: "Start here when something may be costing money, blocking customers, or putting revenue workflows at risk.",
  },
  proof: {
    title: "Proof",
    description:
      "Revenue exposure, protected value, outcomes, and leadership-ready proof.",
    helper: "Start here when you need to show what Solvren protected and where attention should go next.",
  },
  setup: {
    title: "Setup",
    description:
      "Connect systems, invite people, tune decision rules, and manage organization settings.",
    helper: "Setup increases Solvren coverage and makes the value visible faster.",
  },
  changes: {
    title: "Change reviews",
    description:
      "Revenue-sensitive changes that need proof, approval, or follow-up before they move forward.",
    helper: "Use this when a release, pricing update, billing change, or workflow change could affect revenue.",
  },
  integrations: {
    title: "Connected systems",
    description:
      "The systems Solvren watches to find problems, review risky changes, and prove outcomes.",
    helper: "Healthy connections make Solvren more accurate and easier to trust.",
  },
  settings: {
    title: "Organization setup",
    description:
      "Users, access, security, notifications, and decision rules for your Solvren workspace.",
    helper: "Keep setup simple by changing only the controls your team actually needs.",
  },
} as const;

export const INTERNAL_LANGUAGE_GUIDE = {
  prefer: [
    "money at risk",
    "needs attention",
    "proof",
    "decision",
    "problem",
    "protected value",
    "connected systems",
    "organization setup",
  ],
  reserveForDetails: [
    "governance",
    "signals",
    "policy engine",
    "workflow state",
    "evidence requirements",
    "audit trail",
    "SLA",
    "lifecycle",
    "autonomy",
    "domain",
    "verification",
    "severity",
  ],
} as const;
