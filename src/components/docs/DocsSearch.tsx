"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";

type Result = {
  title: string;
  description: string;
  href: string;
  section: string;
  headings: string[];
  snippet: string;
};

export function DocsSearch({ placeholder = "Search docs..." }: { placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!trimmed) {
      queueMicrotask(() => {
        setResults([]);
        setOpen(false);
      });
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/docs/search?q=" + encodeURIComponent(trimmed), {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results);
        setOpen(true);
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => trimmed && results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-solid-bg)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--focus)]"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="block rounded-xl px-4 py-3 transition hover:bg-white/5"
                  onClick={() =>
                    trackDocsEvent("docs_search_result_click", {
                      query: trimmed,
                      href: r.href,
                      title: r.title,
                    })
                  }
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                    {r.section}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">{r.title}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{r.description}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-[var(--text-subtle)]">{r.snippet}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-[var(--text-muted)]">No results found.</div>
          )}
        </div>
      )}
    </div>
  );
}
