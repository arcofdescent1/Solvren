import { Input } from "@/ui";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import OrgSwitcher from "@/components/OrgSwitcher";
import ThemeToggle from "@/components/theme/ThemeToggle";
import type React from "react";
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[13px] font-semibold text-[color:var(--rg-muted)] hover:text-[color:var(--rg-text)] px-3 py-2 rounded-[var(--rg-radius)] hover:bg-[color:var(--rg-panel-2)] transition"
    >
      {children}
    </Link>
  );
}

export default async function NavBar() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes.user) {
    return (
      <header className="sticky top-0 z-40 border-b border-[color:var(--rg-border-strong)] bg-[color:var(--rg-panel)] shadow-[var(--rg-shadow-sm)]">
        <div className="h-16 px-4 sm:px-6 lg:px-8 mx-auto max-w-[1400px] flex items-center justify-between">
          <Link href="/" className="font-bold text-[15px] tracking-[-0.01em] text-[color:var(--rg-text)]">
            Solvren
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-[13px] font-medium text-[color:var(--rg-primary)] hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const { count } = await supabase
    .from("in_app_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userRes.user.id)
    .is("read_at", null);

  const unreadCount = count ?? 0;

  const { activeOrgId, memberships } = await getActiveOrg(
    supabase,
    userRes.user.id
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--rg-border-strong)] bg-[color:var(--rg-panel)] shadow-[var(--rg-shadow-sm)]">
      <div className="h-16 px-4 sm:px-6 lg:px-8 mx-auto max-w-[1400px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="font-bold text-[15px] tracking-[-0.01em] text-[color:var(--rg-text)]"
          >
            Solvren
          </Link>

          {memberships.length > 1 && activeOrgId ? (
            <OrgSwitcher options={memberships} activeOrgId={activeOrgId} />
          ) : null}

          <nav className="hidden lg:flex items-center gap-1">
            <NavLink href="/dashboard">Overview</NavLink>
            <NavLink href="/actions">Actions</NavLink>
            <NavLink href="/changes">Changes</NavLink>
            <NavLink href="/risk/audit">Risks</NavLink>
            <NavLink href="/reports/revenue-governance">Reports</NavLink>
            <NavLink href="/org/settings">Settings</NavLink>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3 flex-1 justify-center">
          <div className="w-full max-w-[520px]">
            <Input
              aria-label="Search"
              placeholder="Search"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/notifications"
            className="relative inline-flex items-center justify-center h-10 w-10 rounded-[var(--rg-radius)] border border-[color:var(--rg-border-strong)] bg-[color:var(--rg-panel)] text-[color:var(--rg-text)] hover:bg-[color:var(--rg-panel-2)] transition"
            aria-label="Notifications"
          >
            <span aria-hidden className="text-[16px]">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--rg-danger)] text-white min-w-[18px] text-center border border-white/50">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
