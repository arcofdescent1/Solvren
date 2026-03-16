import type { ReactNode } from "react";

export function DocsReleaseTimeline({ children }: { children: ReactNode }) {
  return <div className="my-8 space-y-6">{children}</div>;
}

export function DocsReleaseItem({
  version,
  date,
  children,
}: {
  version: string;
  date?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-xl font-semibold text-white">{version}</div>
        {date ? (
          <div className="text-sm text-slate-400">{date}</div>
        ) : null}
      </div>
      <div className="mt-4 text-sm leading-7 text-slate-300">{children}</div>
    </div>
  );
}
