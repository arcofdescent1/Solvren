"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/ui/navigation/SignOutButton";
import type { InternalEmployeeRole } from "@/lib/internal/employeeRoles";

export function InternalAppShell({
  children,
  employeeEmail,
  employeeRole,
}: {
  children: ReactNode;
  employeeEmail: string;
  employeeRole: InternalEmployeeRole;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold">Solvren internal</span>
          <nav className="flex gap-3">
            <Link href="/internal" className="underline-offset-4 hover:underline">
              Home
            </Link>
            <Link href="/internal/accounts" className="underline-offset-4 hover:underline">
              Accounts
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {employeeEmail} · {employeeRole}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
