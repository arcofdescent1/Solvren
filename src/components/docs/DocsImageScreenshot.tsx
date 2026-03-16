"use client";

import Image from "next/image";
import { useState } from "react";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";

export function DocsImageScreenshot(p: {
  src: string;
  alt: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  const width = p.width ?? 1600;
  const height = p.height ?? 900;

  function handleOpen() {
    setOpen(true);
    trackDocsEvent("docs_screenshot_open", {
      src: p.src,
      title: p.title ?? p.alt,
    });
  }

  return (
    <>
      <figure className="my-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl">
          {p.title ? (
            <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white">
              {p.title}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleOpen}
            className="block w-full cursor-zoom-in bg-slate-950"
          >
            <Image
              src={p.src}
              alt={p.alt}
              width={width}
              height={height}
              className="h-auto w-full object-cover"
            />
          </button>
        </div>

        {p.caption ? (
          <figcaption className="mt-3 text-sm leading-6 text-slate-400">
            {p.caption}
          </figcaption>
        ) : null}
      </figure>

      {open ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={p.src}
              alt={p.alt}
              width={width}
              height={height}
              className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
