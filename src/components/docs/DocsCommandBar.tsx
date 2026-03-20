"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";
import { useEffect, useMemo, useState } from "react";

type SearchDoc = { title: string; description: string; section: string; href: string; content: string };
type ResultItem = { title: string; description: string; href: string; section: string; snippet: string };

function scoreDoc(doc: SearchDoc, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  if (doc.title.toLowerCase().includes(q)) score += 100;
  if (doc.section.toLowerCase().includes(q)) score += 30;
  if (doc.description.toLowerCase().includes(q)) score += 20;
  if (doc.content.toLowerCase().includes(q)) score += 10;
  const words = q.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (doc.title.toLowerCase().includes(w)) score += 15;
    if (doc.content.toLowerCase().includes(w)) score += 5;
  }
  return score;
}

export function DocsCommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const router = useRouter();
  const q = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((p) => !p);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    fetch("/docs-search-index.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SearchDoc[] | null) => {
        if (Array.isArray(data)) setDocs(data);
      })
      .catch(() => {});
  }, []);

  const results = useMemo((): ResultItem[] => {
    if (!open) return [];
    if (!q) return [];
    if (docs.length === 0) return [];

    return docs
      .map((doc) => ({ doc, score: scoreDoc(doc, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ doc }) => ({
        title: doc.title,
        description: doc.description,
        href: doc.href,
        section: doc.section,
        snippet: doc.content.slice(0, 120) + (doc.content.length > 120 ? "…" : ""),
      }));
  }, [open, q, docs]);

  const [apiResults, setApiResults] = useState<ResultItem[]>([]);
  useEffect(() => {
    if (!open || !q || docs.length > 0) {
      queueMicrotask(() => setApiResults([]));
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/docs/search?q=" + encodeURIComponent(q), { signal: ac.signal });
        const d = (await r.json()) as { results: ResultItem[] };
        setApiResults(d.results ?? []);
        trackDocsEvent("docs_search", { query: q, source: "command_bar", results: (d.results ?? []).length });
      } catch {
        setApiResults([]);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [open, q, docs.length]);

  const displayResults = docs.length > 0 ? results : apiResults;

  const handleSelect = (item: ResultItem) => {
    trackDocsEvent("docs_search_result_click", {
      query: q,
      href: item.href,
      title: item.title,
      source: "command_bar",
    });
    router.push(item.href);
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search documentation"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[10vh] z-[101] w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--primary)] [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:border-b [&_[cmdk-input]]:border-[var(--border)] [&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:px-4 [&_[cmdk-input]]:text-base [&_[cmdk-input]]:text-[var(--text)] [&_[cmdk-input]]:placeholder:text-[var(--text-subtle)] [&_[cmdk-input]]:outline-none [&_[cmdk-list]]:max-h-[60vh] [&_[cmdk-list]]:overflow-y-auto [&_[cmdk-list]]:py-2 [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:rounded-2xl [&_[cmdk-item]]:px-4 [&_[cmdk-item]]:py-3 [&_[cmdk-item][data-selected=true]]:bg-[var(--bg-muted)] [&_[cmdk-item]:not([data-selected=true])]:hover:bg-[var(--bg-muted)]"
    >
      <Command.Input
        placeholder="Search documentation…"
        value={query}
        onValueChange={setQuery}
      />
      <Command.List>
        {!q && (
          <Command.Group heading="Quick links">
            <Command.Item value="get-started" onSelect={() => handleSelect({ title: "Get Started", description: "", href: "/docs/get-started", section: "Get Started", snippet: "" })}>
              Get Started
            </Command.Item>
            <Command.Item value="first-change" onSelect={() => handleSelect({ title: "Create Your First Change", description: "", href: "/docs/get-started/first-change", section: "Get Started", snippet: "" })}>
              Create Your First Change
            </Command.Item>
            <Command.Item value="user-guide" onSelect={() => handleSelect({ title: "User Guide", description: "", href: "/docs/guides/user-guide", section: "Guides", snippet: "" })}>
              User Guide
            </Command.Item>
            <Command.Item value="change-lifecycle" onSelect={() => handleSelect({ title: "Change Lifecycle", description: "", href: "/docs/guides/change-lifecycle", section: "Guides", snippet: "" })}>
              Change Lifecycle
            </Command.Item>
            <Command.Item value="governance-playbook" onSelect={() => handleSelect({ title: "Governance Playbook", description: "", href: "/docs/playbooks/governance-playbook", section: "Playbooks", snippet: "" })}>
              Governance Playbook
            </Command.Item>
          </Command.Group>
        )}
        {q && results.length > 0 && (
          <Command.Group heading="Search results">
            {results.map((r) => (
              <Command.Item
                key={r.href}
                value={r.href}
                onSelect={() => handleSelect(r)}
              >
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--primary)]">{r.section}</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">{r.title}</div>
                  {r.description && <div className="mt-1 text-xs text-[var(--text-muted)]">{r.description}</div>}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {q && !displayResults.length && <Command.Empty>No docs found. Try a different search term.</Command.Empty>}
      </Command.List>
      <div className="flex justify-between border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-subtle)]">
        <span>↑↓ to navigate</span>
        <span>↵ to open · Esc to close · ⌘K to toggle</span>
      </div>
    </Command.Dialog>
  );
}
