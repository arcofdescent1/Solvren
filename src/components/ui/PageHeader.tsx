import type React from "react";

/**
 * SB Admin Pro baseline page header.
 * - Gradient background (demo-style)
 * - Title + subtitle
 * - Right-aligned action slot
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--rg-radius)] bg-gradient-to-r from-[color:var(--rg-primary)] to-[#6900c7] text-white shadow-[var(--rg-shadow)]">
      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[26px] leading-[32px] font-bold tracking-[-0.01em]">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-[14px] leading-5 text-white/80">
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>

      {/* Subtle highlight sweep (unobtrusive eye candy) */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
    </div>
  );
}
