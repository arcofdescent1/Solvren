"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function NavItem({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        active ? "bg-[var(--bg-surface-2)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-2)]",
        className
      )}
    >
      {label}
    </Link>
  );
}
