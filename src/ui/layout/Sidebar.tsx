"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { HELP_DOCS_NAV_ITEM, PRIMARY_APP_NAV } from "@/config/appNavigation";
import { trackAppEvent } from "@/lib/appAnalytics";

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
  open?: boolean;
};

function SidebarNavLink({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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

export function Sidebar({ user, open = true }: SidebarProps) {
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
          {PRIMARY_APP_NAV.map((item) => {
            const active = item.activeMatch.some(
              (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
            );
            const Icon = item.icon;
            return (
              <SidebarNavLink
                key={item.key}
                href={item.href}
                label={item.label}
                icon={<Icon />}
                active={active}
                onClick={() =>
                  trackAppEvent("primary_nav_click", {
                    nav_key: item.key,
                    source_page: pathname,
                    destination: item.href,
                  })
                }
              />
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <SidebarNavLink
          href={HELP_DOCS_NAV_ITEM.href}
          label={HELP_DOCS_NAV_ITEM.label}
          icon={<HELP_DOCS_NAV_ITEM.icon />}
          active={pathname === HELP_DOCS_NAV_ITEM.href || pathname.startsWith(`${HELP_DOCS_NAV_ITEM.href}/`)}
          onClick={() =>
            trackAppEvent("help_docs_click", {
              source_page: pathname,
              destination: HELP_DOCS_NAV_ITEM.href,
            })
          }
        />
      </div>

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
