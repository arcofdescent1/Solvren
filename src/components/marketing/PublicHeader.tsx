"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/ui";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-executives", label: "For executives" },
  { href: "/for-engineering", label: "For engineering" },
  { href: "/for-finance", label: "For finance" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
];
const CANONICAL_SITE_URL = "https://www.solvren.com";

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/65">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-10">
          <Link href={CANONICAL_SITE_URL} className="flex items-center gap-3">
            <img src="/images/Solvren.svg" alt="Solvren" className="h-10 w-10 shrink-0 object-contain" />
            <div>
              <div className="text-sm font-semibold tracking-tight text-white">Solvren</div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Revenue protection platform</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="whitespace-nowrap text-sm font-medium text-slate-300 transition hover:text-white">
            Sign in
          </Link>
          <Link href="/signup">
            <Button className="bg-white text-slate-950 hover:brightness-95">Start Free Trial</Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className={cn("border-t border-white/10 lg:hidden", open ? "block" : "hidden")}>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <Link href="/login" className="flex-1 whitespace-nowrap">
              <Button variant="outline" className="w-full border-white/15 text-white hover:bg-white/5">
                Sign in
              </Button>
            </Link>
            <Link href="/signup" className="flex-1">
              <Button className="w-full bg-white text-slate-950">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
