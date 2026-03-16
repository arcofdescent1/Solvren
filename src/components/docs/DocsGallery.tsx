import type { ReactNode } from "react";

export function DocsGallery({ children }: { children: ReactNode }) {
  return <div className="my-8 grid gap-4 md:grid-cols-2">{children}</div>;
}

export function DocsGalleryItem(p: {
  title?: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl">
      {p.title ? (
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white">
          {p.title}
        </div>
      ) : null}
      <div className="p-4">{p.children}</div>
      {p.caption ? (
        <figcaption className="px-4 pb-4 text-sm leading-6 text-slate-400">
          {p.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
