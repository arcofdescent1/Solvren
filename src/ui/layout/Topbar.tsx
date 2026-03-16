"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, HelpCircle, Menu } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import OrgSwitcher from "@/components/OrgSwitcher";
import { SignOutButton } from "@/ui/navigation/SignOutButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";
import { GlobalSearchBar } from "@/components/search/GlobalSearchBar";
import type { OrgMembership } from "@/lib/org/activeOrg";

export type TopbarProps = {
  user?: { id: string; email?: string } | null;
  memberships?: OrgMembership[];
  activeOrgId?: string | null;
  unreadCount?: number;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
};

export function Topbar({
  user,
  memberships = [],
  activeOrgId,
  unreadCount = 0,
  sidebarOpen,
  onSidebarToggle,
}: TopbarProps) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-[var(--z-topbar)] flex h-[var(--topbar-height)] items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 shadow-sm">
      {/* Sidebar toggle - always visible */}
      <button
        type="button"
        onClick={onSidebarToggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sb)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-2)] hover:text-[var(--text)] lg:-ml-2"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Brand - hidden on mobile, shown on sm+ */}
      <Link
        href={user ? "/dashboard" : "/"}
        className="hidden shrink-0 font-bold tracking-tight text-[var(--text)] sm:block"
      >
        Solvren
      </Link>

      {/* Search - centered on desktop, hidden on mobile */}
      {user ? (
        <div className="hidden flex-1 max-w-xl lg:block">
          <GlobalSearchBar placeholder="Search changes, risks, issues…" />
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {user && memberships.length > 1 && activeOrgId ? (
          <OrgSwitcher options={memberships} activeOrgId={activeOrgId} />
        ) : null}

        <ThemeToggle />

        {user ? (
          <>
            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sb)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-2)] hover:text-[var(--text)]"
              aria-label="Help (opens in new tab)"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
            <Link
              href="/notifications"
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sb)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-2)] hover:text-[var(--text)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-[var(--text-inverse)]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                  aria-label="User menu"
                >
                  <span className="flex h-full w-full items-center justify-center bg-[var(--primary)]/20 text-sm font-semibold text-[var(--primary)]">
                    {(user.email ?? "?").charAt(0).toUpperCase()}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[13rem]">
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-sm font-semibold text-[var(--primary)]">
                    {(user.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {user.email ?? "User"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/org/settings" className="flex items-center gap-2 cursor-pointer">
                    <span className="flex h-4 w-4 items-center justify-center">⚙</span>
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="p-1">
                  <SignOutButton />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Link href="/login">
            <Button variant="default" size="sm">
              Log in
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
