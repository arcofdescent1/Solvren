import type { ReactNode } from "react";

/**
 * Shared layout for first-party legal and policy pages (public shell).
 */
export function SimpleLegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      <div className="mt-8 space-y-4 text-base leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}
