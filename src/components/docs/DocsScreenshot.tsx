import type { ReactNode } from "react";

export function DocsScreenshot(p: {
  title?: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl">
        {p.title ? (
          <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white">
            {p.title}
          </div>
        ) : null}
        <div className="p-4">{p.children}</div>
      </div>
      {p.caption ? (
        <figcaption className="mt-3 text-sm leading-6 text-slate-400">
          {p.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function DocsScreenshotPlaceholder(p: { label: string; lines?: number }) {
  const lines = p.lines ?? 5;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
        {p.label}
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800"
            style={{ width: `${100 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
