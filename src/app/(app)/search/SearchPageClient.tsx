"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GitBranch, Server, CheckSquare, FileText, Search } from "lucide-react";
import { PageHeader, Card, CardBody } from "@/ui";
import { Input } from "@/ui/primitives/input";
import { Button } from "@/ui/primitives/button";
import { NativeSelect } from "@/ui/primitives/select";

type SearchChange = { id: string; title: string; status: string | null; change_type: string | null; domain: string | null; systems_involved: string[]; submitted_at: string | null };
type SearchSystem = { id: string; title: string; href: string };
type SearchApproval = { id: string; change_event_id: string; change_title: string | null; approval_area: string; decision: string };
type SearchEvidence = { id: string; change_event_id: string; change_title: string | null; kind: string; label: string };
type SearchUser = { id: string; title: string; subtitle: string; email: string };

type SearchResult = {
  changes: SearchChange[];
  systems: SearchSystem[] | string[];
  approvals: SearchApproval[];
  evidence: SearchEvidence[];
  users?: SearchUser[];
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SearchPageClient({
  initialQ,
  initialStatus,
  initialSystem,
  initialChangeType,
  initialDomain,
  initialTypes,
}: {
  initialQ: string;
  initialStatus: string;
  initialSystem: string;
  initialChangeType: string;
  initialDomain: string;
  initialTypes: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQ);
  const [status, setStatus] = React.useState(initialStatus);
  const [system, setSystem] = React.useState(initialSystem);
  const [changeType, setChangeType] = React.useState(initialChangeType);
  const [domain, setDomain] = React.useState(initialDomain);
  const [types, setTypes] = React.useState(initialTypes);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const applyFilters = React.useCallback(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (status) sp.set("status", status);
    if (system) sp.set("system", system);
    if (changeType) sp.set("changeType", changeType);
    if (domain) sp.set("domain", domain);
    if (types) sp.set("types", types);
    router.push(`/search?${sp.toString()}`);
  }, [query, status, system, changeType, domain, types, router]);

  React.useEffect(() => {
    setQuery(initialQ);
    setStatus(initialStatus);
    setSystem(initialSystem);
    setChangeType(initialChangeType);
    setDomain(initialDomain);
    setTypes(initialTypes);
  }, [initialQ, initialStatus, initialSystem, initialChangeType, initialDomain, initialTypes]);

  React.useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ q, limit: "20", page: "1" });
    if (searchParams.get("status")) params.set("status", searchParams.get("status")!);
    if (searchParams.get("system")) params.set("system", searchParams.get("system")!);
    if (searchParams.get("changeType")) params.set("changeType", searchParams.get("changeType")!);
    if (searchParams.get("domain")) params.set("domain", searchParams.get("domain")!);
    const typesParam = searchParams.get("types");
    if (typesParam) params.set("types", typesParam);

    fetch(`/api/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; changes?: unknown[]; systems?: string[]; approvals?: unknown[]; evidence?: unknown[] }) => {
        if (cancelled) return;
        const d = data as { changes?: SearchChange[]; systems?: SearchSystem[] | string[]; approvals?: SearchApproval[]; evidence?: SearchEvidence[]; users?: SearchUser[] };
        setResults({
          changes: d.changes ?? [],
          systems: (d.systems ?? []) as SearchSystem[] | string[],
          approvals: d.approvals ?? [],
          evidence: d.evidence ?? [],
          users: d.users ?? [],
        });
      })
      .catch((err) => {
        if (!cancelled) setError(String(err.message ?? "Search failed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const q = searchParams.get("q") ?? "";
  const hasFilters = status || system || changeType || domain || types;
  const hasResults = results && (
    results.changes.length > 0 ||
    results.systems.length > 0 ||
    results.approvals.length > 0 ||
    results.evidence.length > 0 ||
    (results.users?.length ?? 0) > 0
  );

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Search" }]}
        title="Search"
        description="Search changes, systems, approvals, and evidence across your workspace."
      />

      <Card>
        <CardBody className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label htmlFor="search-query" className="mb-1 block text-sm font-medium text-[var(--text)]">
                Search query
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  id="search-query"
                  className="pl-9"
                  placeholder="Search by title, ID, system, domain…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="filter-status" className="mb-1 block text-xs text-[var(--text-muted)]">Status</label>
                <NativeSelect
                  id="filter-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="min-w-[120px]"
                >
                  <option value="">Any</option>
                  <option value="DRAFT">Draft</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="IMPLEMENTED">Implemented</option>
                </NativeSelect>
              </div>
              <div>
                <label htmlFor="filter-domain" className="mb-1 block text-xs text-[var(--text-muted)]">Domain</label>
                <Input
                  id="filter-domain"
                  placeholder="Domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="min-w-[100px]"
                />
              </div>
              <div>
                <label htmlFor="filter-system" className="mb-1 block text-xs text-[var(--text-muted)]">System</label>
                <Input
                  id="filter-system"
                  placeholder="System"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  className="min-w-[100px]"
                />
              </div>
              <div>
                <label htmlFor="filter-changeType" className="mb-1 block text-xs text-[var(--text-muted)]">Change type</label>
                <Input
                  id="filter-changeType"
                  placeholder="Change type"
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="min-w-[100px]"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>
          </form>

          {q.length > 0 && q.length < 2 && (
            <p className="text-sm text-[var(--text-muted)]">Enter at least 2 characters to search.</p>
          )}
        </CardBody>
      </Card>

      {error && (
        <Card className="border-[var(--danger)]/50">
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </CardBody>
        </Card>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">Searching…</div>
      )}

      {!loading && q.length >= 2 && !error && (
        <div className="space-y-6">
          {!hasResults ? (
            <Card>
              <CardBody>
                <p className="text-center text-[var(--text-muted)]">
                  No results for &quot;{q}&quot;{hasFilters ? " with the selected filters." : "."}
                </p>
                <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
                  Try searching by change title, system, domain, or evidence kind.
                </p>
              </CardBody>
            </Card>
          ) : (
            <>
              {results!.changes.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                    <GitBranch className="h-5 w-5" />
                    Changes ({results!.changes.length})
                  </h2>
                  <div className="space-y-2">
                    {results!.changes.map((c) => (
                      <Link
                        key={c.id}
                        href={(c as { href?: string }).href ?? `/changes/${c.id}`}
                        className="block rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-muted)]"
                      >
                        <div className="font-medium text-[var(--text)]">{c.title ?? c.id}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                          {c.status && (
                            <span className="rounded bg-[var(--bg-surface-2)] px-1.5 py-0.5">{c.status}</span>
                          )}
                          {c.change_type && (
                            <span>{c.change_type}</span>
                          )}
                          {c.domain && <span>{c.domain}</span>}
                          {c.systems_involved?.[0] && <span>{c.systems_involved.join(", ")}</span>}
                          <span>Submitted: {fmtDate(c.submitted_at)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results!.systems.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                    <Server className="h-5 w-5" />
                    Systems ({results!.systems.length})
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {results!.systems.map((s) => {
                      const sys = typeof s === "string" ? { id: s, title: s, href: `/search?q=${encodeURIComponent(s)}&system=${encodeURIComponent(s)}` } : s;
                      const sysHref = (sys as { href?: string }).href ?? `/search?q=${encodeURIComponent(sys.title)}&system=${encodeURIComponent(sys.title)}`;
                      return (
                        <Link
                          key={sys.id}
                          href={sysHref}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
                        >
                          {sys.title}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {results!.approvals.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                    <CheckSquare className="h-5 w-5" />
                    Approvals ({results!.approvals.length})
                  </h2>
                  <div className="space-y-2">
                    {results!.approvals.map((a) => (
                      <Link
                        key={a.id}
                        href={`/changes/${a.change_event_id}`}
                        className="block rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-muted)]"
                      >
                        <div className="font-medium text-[var(--text)]">
                          {a.approval_area} – {a.change_title ?? a.change_event_id}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          Decision: {a.decision}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {results!.evidence.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                    <FileText className="h-5 w-5" />
                    Evidence ({results!.evidence.length})
                  </h2>
                  <div className="space-y-2">
                    {results!.evidence.map((e) => (
                      <Link
                        key={e.id}
                        href={(`href` in e && typeof e.href === "string") ? e.href : `/changes/${e.change_event_id}`}
                        className="block rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-muted)]"
                      >
                        <div className="font-medium text-[var(--text)]">
                          {e.label || e.kind} – {e.change_title ?? e.change_event_id}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {e.kind}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
