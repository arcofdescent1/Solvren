"use client";

import { appFooterLinks, footerLegalLine } from "@/config/footerNav";
import { FooterLink } from "./FooterLink";
import { useLayout } from "@/ui/layout/LayoutContext";
import { cn } from "@/lib/cn";

export function AppFooter() {
  const { sidebarOpen } = useLayout();
  return (
    <footer
      aria-label="Site footer"
      className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-sm text-[var(--text-muted)]"
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1600px] flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between transition-[padding] duration-200",
          sidebarOpen ? "lg:pl-[var(--sidenav-width)]" : "lg:pl-0"
        )}
      >
        <nav aria-label="Legal and support">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {appFooterLinks.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                <FooterLink
                  link={link}
                  className="text-[var(--text-muted)] transition hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
                />
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-[var(--text-muted)] sm:text-right">{footerLegalLine}</p>
      </div>
    </footer>
  );
}
