"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck,
  Shield,
  BarChart3,
  Building2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type SidebarSection = {
  heading: string;
  items: Array<{
    href: string;
    label: string;
    icon?: React.ReactNode;
    adminOnly?: boolean;
  }>;
};

export type SidebarProps = {
  user?: { id: string; email?: string } | null;
  memberships?: Array<{ orgId: string; orgName: string | null; role: string | null }>;
  activeOrgId?: string | null;
  open?: boolean;
};

function SidebarNavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-sb)] px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-l-4 border-l-[var(--primary)] bg-[var(--primary)]/10 text-[var(--sidenav-link-active)]"
          : "border-l-4 border-l-transparent text-[var(--sidenav-link)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--sidenav-link-active)]"
      )}
    >
      {icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {label}
    </Link>
  );
}

/** Phase 0: Issues-first nav — Issues, Overview, Changes, Risks, Reports, Settings. */
const PRIMARY_NAV_ITEMS = [
  { href: "/issues", label: "Issues", icon: <AlertCircle /> },
  { href: "/actions", label: "Actions", icon: <Zap /> },
  { href: "/dashboard", label: "Overview", icon: <LayoutDashboard /> },
  { href: "/changes", label: "Changes", icon: <FileCheck /> },
  { href: "/risk/audit", label: "Risks", icon: <Shield /> },
  { href: "/reports/revenue-governance", label: "Reports", icon: <BarChart3 /> },
  { href: "/org/settings", label: "Settings", icon: <Building2 /> },
];

export function Sidebar({ user, memberships = [], activeOrgId, open = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-[var(--topbar-height)] z-[var(--z-sidenav)] flex h-[calc(100vh-var(--topbar-height))] w-[var(--sidenav-width)] flex-col border-r border-[var(--border)] bg-[var(--sidenav-bg)] text-[var(--sidenav-color)] shadow-[var(--shadow-right)] transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full",
        "lg:transition-none",
        open ? "lg:translate-x-0" : "lg:-translate-x-full"
      )}
    >
      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        <div className="flex flex-col gap-0.5">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isSettings = item.href === "/org/settings";
            const isRisks = item.href === "/risk/audit";
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              (isSettings && (pathname.startsWith("/settings") || pathname.startsWith("/integrations") || pathname.startsWith("/admin"))) ||
              (isRisks && pathname.startsWith("/risk"));
            return (
              <SidebarNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
              />
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {user?.email && (
        <div className="flex shrink-0 items-center border-t border-[var(--border)] bg-[var(--sidenav-footer-bg)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] text-[var(--text-muted)]">Logged in as</p>
            <p className="truncate text-sm font-medium text-[var(--sidenav-color)]">
              {user.email}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
