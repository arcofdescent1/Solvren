"use client";

import Link from "next/link";
import type { FooterNavLink } from "@/config/footerNav";
import { trackFooterNavigationEvent } from "@/lib/analytics/footerNavigation";

export function FooterLink({ link, className }: { link: FooterNavLink; className?: string }) {
  const cn = className ?? "mb-4 inline-block text-base transition hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  function onClick() {
    if (link.analyticsKey) {
      trackFooterNavigationEvent(link.analyticsKey, { link_label: link.label, href: link.href });
    }
  }

  if (link.external) {
    return (
      <a
        href={link.href}
        className={cn}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={cn} onClick={onClick}>
      {link.label}
    </Link>
  );
}
