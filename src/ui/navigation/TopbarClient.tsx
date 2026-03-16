"use client";

import * as React from "react";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { Container } from "@/ui/layout/container";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { Input } from "@/ui/primitives/input";
import { Button } from "@/ui/primitives/button";
import { NavItem } from "./nav-item";
import OrgSwitcher from "@/components/OrgSwitcher";
import type { OrgMembership } from "@/lib/org/activeOrg";
export type TopbarClientProps = {
  user?: { id: string; email?: string } | null;
  memberships?: OrgMembership[];
  activeOrgId?: string | null;
  unreadCount?: number;
};

export function TopbarClient({
  user,
  memberships = [],
  activeOrgId,
  unreadCount = 0,
}: TopbarClientProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur">
      <Container className="flex h-14 items-center gap-3">
        <Link
          href={user ? "/dashboard" : "/"}
          className="font-bold tracking-tight"
        >
          Solvren
        </Link>

        {user && memberships.length > 1 && activeOrgId ? (
          <OrgSwitcher options={memberships} activeOrgId={activeOrgId} />
        ) : null}

        {user ? (
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem href="/dashboard" label="Overview" />
            <NavItem href="/changes" label="Changes" />
            <NavItem href="/risk/audit" label="Risks" />
            <NavItem href="/reports/revenue-governance" label="Reports" />
            <NavItem href="/org/settings" label="Settings" />
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="hidden w-[340px] lg:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                <Input className="pl-9" placeholder="Search" />
              </div>
            </div>
          ) : null}
          <ThemeToggle />
          {user ? (
            <Link
              href="/notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm">
                Log in
              </Button>
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
}
