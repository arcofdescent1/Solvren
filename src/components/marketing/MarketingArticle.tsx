import type { ReactNode } from "react";

/**
 * Standard interior marketing page body (used inside PublicShell main).
 */
export function MarketingArticle({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      {intro ? <p className="mt-4 text-lg leading-relaxed text-slate-300">{intro}</p> : null}
      {children ? <div className="mt-8 space-y-4 text-base leading-relaxed text-slate-300">{children}</div> : null}
    </div>
  );
}
