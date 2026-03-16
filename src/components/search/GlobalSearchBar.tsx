"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, GitBranch, Server, CheckSquare, FileText } from "lucide-react";
import { Input } from "@/ui/primitives/input";
import { cn } from "@/lib/cn";

type SearchChangeItem = {
  id: string;
  title?: string | null;
  status?: string | null;
  change_type?: string | null;
  domain?: string | null;
  systems_involved?: string[];
  href?: string;
};

type SearchSystemItem = string | { id: string; title: string; href?: string };

type SearchApprovalItem = {
  id: string;
  change_event_id: string;
  change_title: string | null;
  approval_area: string;
  decision: string;
  href?: string;
};

type SearchEvidenceItem = {
  id: string;
  change_event_id: string;
  change_title: string | null;
  kind: string;
  label: string;
  href?: string;
};

export type SearchResult = {
  changes: SearchChangeItem[];
  systems: SearchSystemItem[];
  approvals: SearchApprovalItem[];
  evidence: SearchEvidenceItem[];
};

const DEBOUNCE_MS = 150;
const MIN_QUERY_LEN = 2;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export function GlobalSearchBar({
  className,
  placeholder = "Search changes, systems, approvals…",
}: {
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult | null>(null);
  const [selectedIdx, setSelectedIdx] = React.useState(-1);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Build flat list of clickable items for keyboard nav
  const items = React.useMemo(() => {
    type Item = { type: "change" | "system" | "approval" | "evidence"; href: string; label: string; id?: string };
    const out: Item[] = [];
    if (!results) return out;
    for (const c of results.changes) {
      const ch = c as { id: string; title?: string; href?: string };
      out.push({ type: "change", href: ch.href ?? `/changes/${ch.id}`, label: ch.title ?? ch.id });
    }
    for (const s of results.systems) {
      const sys = typeof s === "string" ? { id: s, title: s, href: `/search?q=${encodeURIComponent(s)}&system=${encodeURIComponent(s)}` } : s;
      out.push({ type: "system", href: (sys as { href?: string }).href ?? `/search?q=${encodeURIComponent((sys as { title: string }).title)}&system=${encodeURIComponent((sys as { title: string }).title)}`, label: (sys as { title: string }).title });
    }
    for (const a of results.approvals) {
      const ah = (a as SearchApprovalItem & { href?: string }).href;
      out.push({ type: "approval", href: ah ?? `/changes/${a.change_event_id}`, label: `${a.approval_area} – ${a.change_title ?? a.change_event_id}`, id: a.id });
    }
    for (const e of results.evidence) {
      const eh = (e as SearchEvidenceItem & { href?: string }).href;
      out.push({ type: "evidence", href: eh ?? `/changes/${e.change_event_id}`, label: `${e.label || e.kind} – ${e.change_title ?? e.change_event_id}`, id: e.id });
    }
    return out;
  }, [results]);

  React.useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LEN) {
      setResults(null);
      setLoading(false);
      setSelectedIdx(-1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; changes?: unknown[]; systems?: string[]; approvals?: unknown[]; evidence?: unknown[] }) => {
        if (cancelled) return;
        const d = data as { changes?: SearchChangeItem[]; systems?: SearchSystemItem[]; approvals?: SearchApprovalItem[]; evidence?: SearchEvidenceItem[] };
        setResults({
          changes: d.changes ?? [],
          systems: d.systems ?? [],
          approvals: d.approvals ?? [],
          evidence: d.evidence ?? [],
        });
        setSelectedIdx(-1);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const showDropdown = open && query.length >= MIN_QUERY_LEN;
  const hasResults =
    results &&
    (results.changes.length > 0 ||
      results.systems.length > 0 ||
      results.approvals.length > 0 ||
      results.evidence.length > 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && items[selectedIdx]) {
        router.push(items[selectedIdx].href);
        setOpen(false);
        setQuery("");
      } else if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i < items.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i > 0 ? i - 1 : -1));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  // Keyboard shortcut: /
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };
  React.useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form role="search" onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <Input
          ref={inputRef}
          className="h-9 w-full pl-9 pr-8"
          placeholder={placeholder}
          type="search"
          aria-label="Search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-[var(--border)] bg-[var(--bg-surface-2)] px-1.5 font-mono text-[10px] text-[var(--text-muted)]">
          /
        </kbd>
      </form>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(400px,70vh)] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
          role="listbox"
        >
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Searching…</div>
          ) : !hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            <>
              {results!.changes.length > 0 && (
                <div className="border-b border-[var(--border)] p-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <GitBranch className="h-3.5 w-3.5" />
                    Changes
                  </div>
                  {results!.changes.map((c) => {
                    const chHref = (c as SearchChangeItem).href ?? `/changes/${c.id}`;
                    const idx = items.findIndex((it) => it.type === "change" && it.href === chHref);
                    const sel = idx >= 0 && idx === selectedIdx;
                    return (
                      <a
                        key={c.id}
                        href={chHref}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(chHref);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex flex-col gap-0.5 rounded px-3 py-2 text-left transition-colors",
                          sel ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"
                        )}
                        role="option"
                        aria-selected={sel}
                      >
                        <span className="truncate text-sm font-medium text-[var(--text)]">
                          {c.title || c.id}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {[c.status, c.change_type, c.systems_involved?.[0]].filter(Boolean).join(" · ")}
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
              {results!.systems.length > 0 && (
                <div className="border-b border-[var(--border)] p-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <Server className="h-3.5 w-3.5" />
                    Systems
                  </div>
                  {results!.systems.map((s) => {
                    const sys = typeof s === "string" ? { id: s, title: s, href: `/search?q=${encodeURIComponent(s)}&system=${encodeURIComponent(s)}` } : s;
                    const idx = items.findIndex((it) => it.type === "system" && it.label === sys.title);
                    const sel = idx >= 0 && idx === selectedIdx;
                    const sysHref = (sys as { href?: string }).href ?? `/search?q=${encodeURIComponent(sys.title)}&system=${encodeURIComponent(sys.title)}`;
                    return (
                      <a
                        key={sys.id}
                        href={sysHref}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(sysHref);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--text)] transition-colors",
                          sel ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"
                        )}
                        role="option"
                        aria-selected={sel}
                      >
                        {sys.title}
                      </a>
                    );
                  })}
                </div>
              )}
              {results!.approvals.length > 0 && (
                <div className="border-b border-[var(--border)] p-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Approvals
                  </div>
                  {results!.approvals.map((a) => {
                    const idx = items.findIndex((it) => it.type === "approval" && it.id === a.id);
                    const sel = idx >= 0 && idx === selectedIdx;
                    return (
                      <a
                        key={a.id}
                        href={`/changes/${a.change_event_id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/changes/${a.change_event_id}`);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex flex-col gap-0.5 rounded px-3 py-2 text-left transition-colors",
                          sel ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"
                        )}
                        role="option"
                        aria-selected={sel}
                      >
                        <span className="truncate text-sm text-[var(--text)]">
                          {a.approval_area} – {a.change_title || a.change_event_id}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{a.decision}</span>
                      </a>
                    );
                  })}
                </div>
              )}
              {results!.evidence.length > 0 && (
                <div className="p-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <FileText className="h-3.5 w-3.5" />
                    Evidence
                  </div>
                  {results!.evidence.map((e) => {
                    const idx = items.findIndex((it) => it.type === "evidence" && it.id === e.id);
                    const sel = idx >= 0 && idx === selectedIdx;
                    return (
                      <a
                        key={e.id}
                        href={`/changes/${e.change_event_id}`}
                        onClick={(ev) => {
                          ev.preventDefault();
                          router.push(`/changes/${e.change_event_id}`);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex flex-col gap-0.5 rounded px-3 py-2 text-left transition-colors",
                          sel ? "bg-[var(--bg-muted)]" : "hover:bg-[var(--bg-muted)]"
                        )}
                        role="option"
                        aria-selected={sel}
                      >
                        <span className="truncate text-sm text-[var(--text)]">
                          {e.label || e.kind} – {e.change_title || e.change_event_id}
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-[var(--border)] px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(query)}`);
                    setOpen(false);
                  }}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  View all results for &quot;{query}&quot; →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
