"use client";

import * as React from "react";
import { Button, Container, Input, ThemeToggle } from "@/ui";
import { Bell, Search } from "lucide-react";
import { NavItem } from "./nav-item";

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur">
      <Container className="flex h-14 items-center gap-3">
        <div className="font-bold tracking-tight">Solvren</div>

        <nav className="hidden items-center gap-1 md:flex">
          <NavItem href="/dashboard" label="Overview" />
          <NavItem href="/changes" label="Changes" />
          <NavItem href="/risk/audit" label="Risks" />
          <NavItem href="/reports/revenue-governance" label="Reports" />
          <NavItem href="/org/settings" label="Settings" />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden w-[340px] lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
              <Input className="pl-9" placeholder="Search" />
            </div>
          </div>
          <ThemeToggle />
          <Button variant="secondary" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </Container>
    </header>
  );
}
