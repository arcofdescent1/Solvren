"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { footerBrand, footerLegalLine, footerTrustBadges, marketingFooterColumns } from "@/config/footerNav";
import { FooterLink } from "./FooterLink";

function ColumnBlock({
  columnId,
  heading,
  links,
  openMobile,
  onToggle,
}: {
  columnId: string;
  heading: string;
  links: React.ReactNode;
  openMobile: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12">
      <div className="mb-12 lg:mb-16">
        <button
          type="button"
          className="mb-6 flex w-full items-center justify-between text-left lg:mb-10 lg:hidden"
          aria-expanded={openMobile}
          aria-controls={`footer-col-${columnId}`}
          id={`footer-col-trigger-${columnId}`}
          onClick={onToggle}
        >
          <span className="text-xl font-bold text-white">{heading}</span>
          <span className="text-slate-400" aria-hidden>
            {openMobile ? "−" : "+"}
          </span>
        </button>
        <h2 className="mb-10 hidden text-xl font-bold text-white lg:block">{heading}</h2>
        <ul
          id={`footer-col-${columnId}`}
          className={openMobile ? "block" : "hidden lg:block"}
          role="list"
        >
          {links}
        </ul>
      </div>
    </div>
  );
}

export function PublicFooter() {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <footer aria-label="Site footer" className="relative z-10 border-t border-white/10 bg-slate-950 pt-16 text-slate-300 md:pt-20 lg:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 flex flex-wrap">
          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-5/12">
            <div className="mb-12 max-w-[380px] lg:mb-16">
              <Link
                href="/"
                className="mb-8 inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <Image
                  src={footerBrand.logoSrc}
                  alt={footerBrand.logoAlt}
                  className="h-11 w-11 shrink-0 object-contain"
                  width={44}
                  height={44}
                  unoptimized
                />
                <div>
                  <div className="text-base font-semibold text-white">{footerBrand.name}</div>
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{footerBrand.tagline}</div>
                </div>
              </Link>
              <p className="mb-9 text-base leading-relaxed text-slate-300">{footerBrand.blurb}</p>
              {footerTrustBadges.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {footerTrustBadges.map((b) =>
                    b.href ? (
                      <a key={b.src} href={b.href} className="inline-block" target="_blank" rel="noopener noreferrer">
                        <Image src={b.src} alt={b.alt} width={120} height={32} className="h-8 w-auto opacity-90" unoptimized />
                      </a>
                    ) : (
                      <Image key={b.src} src={b.src} alt={b.alt} width={120} height={32} className="h-8 w-auto opacity-90" unoptimized />
                    )
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {marketingFooterColumns.map((col) => (
            <ColumnBlock
              key={col.id}
              columnId={col.id}
              heading={col.heading}
              openMobile={Boolean(open[col.id])}
              onToggle={() => toggle(col.id)}
              links={
                <>
                  {col.links.map((link) => (
                    <li key={`${col.id}-${link.label}-${link.href}`}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </>
              }
            />
          ))}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="py-8">
          <p className="text-center text-base text-slate-400">{footerBrand.closingLine}</p>
          <p className="mt-3 text-center text-sm text-slate-500">{footerLegalLine}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 top-14 -z-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
    </footer>
  );
}
