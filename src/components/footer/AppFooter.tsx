"use client";

import Image from "next/image";
import Link from "next/link";
import { appFooterLinks, footerBrand, footerLegalLine, marketingFooterColumns } from "@/config/footerNav";
import { FooterLink } from "./FooterLink";
import { useLayout } from "@/ui/layout/LayoutContext";
import { cn } from "@/lib/cn";

export function AppFooter() {
  const { sidebarOpen } = useLayout();
  return (
    <footer
      aria-label="Site footer"
      className="border-t border-[var(--border)] bg-[color:color-mix(in_oklab,var(--bg-surface)_94%,var(--bg-app))] px-4 py-10 text-sm text-[var(--text-muted)] shadow-[0_-1px_0_color-mix(in_oklab,var(--border)_70%,transparent)]"
    >
      <div
        className={cn(
          "mx-auto max-w-[1600px] transition-[padding] duration-200",
          sidebarOpen ? "lg:pl-[var(--sidenav-width)]" : "lg:pl-0"
        )}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(240px,1.2fr)_minmax(0,2fr)]">
          <div className="max-w-md">
            <Link
              href="/home"
              className="inline-flex items-center gap-3 rounded-[var(--radius-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
              aria-label="Solvren home"
            >
              <Image
                src={footerBrand.logoSrc}
                alt={footerBrand.logoAlt}
                width={132}
                height={35}
                className="h-8 w-auto object-contain"
                unoptimized
              />
            </Link>
            <p className="mt-4 max-w-sm leading-6 text-[var(--text-muted)]">{footerBrand.blurb}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
              {footerBrand.tagline}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {marketingFooterColumns.map((column) => (
              <nav key={column.id} aria-label={`${column.heading} links`}>
                <h2 className="text-sm font-semibold text-[var(--text)]">{column.heading}</h2>
                <ul className="mt-3 space-y-2">
                  {column.links.slice(0, column.id === "product" ? 6 : 5).map((link) => (
                    <li key={`${column.id}-${link.label}-${link.href}`}>
                      <FooterLink
                        link={link}
                        className="text-sm text-[var(--text-muted)] transition hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <nav aria-label="Legal and support">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {appFooterLinks.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <FooterLink
                      link={link}
                      className="text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
                    />
                  </li>
                ))}
              </ul>
            </nav>
            <p className="text-xs text-[var(--text-muted)] sm:text-right">{footerLegalLine}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
